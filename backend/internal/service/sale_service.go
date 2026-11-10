package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/google/uuid"
)

type SaleService struct {
	saleRepo    *repository.SaleRepository
	variantRepo *repository.VariantRepository
	invRepo     *repository.InventoryRepository
}

func NewSaleService(
	saleRepo *repository.SaleRepository,
	variantRepo *repository.VariantRepository,
	invRepo *repository.InventoryRepository,
) *SaleService {
	return &SaleService{saleRepo: saleRepo, variantRepo: variantRepo, invRepo: invRepo}
}

type SaleItemRequest struct {
	VariantID    uuid.UUID `json:"variant_id"`
	Quantity     int       `json:"quantity"`
	DiscountKobo int64     `json:"discount_kobo"`
}

type PaymentRequest struct {
	Method    string `json:"method"`
	AmountKobo int64 `json:"amount_kobo"`
	Reference  string `json:"reference"`
}

type CreateSaleRequest struct {
	CustomerID uuid.UUID         `json:"customer_id"` // optional; defaults to walk-in
	Items      []SaleItemRequest `json:"items"`
	Payments   []PaymentRequest  `json:"payments"`
	Notes      string            `json:"notes"`
}

// CreateSale processes a POS sale atomically.
// Stock is deducted with SELECT FOR UPDATE to prevent overselling.
func (s *SaleService) CreateSale(ctx context.Context, req CreateSaleRequest, servedBy uuid.UUID) (*model.Sale, error) {
	if len(req.Items) == 0 {
		return nil, errors.New("sale must have at least one item")
	}
	if len(req.Payments) == 0 {
		return nil, errors.New("sale must have at least one payment")
	}

	// Default customer to walk-in
	customerID := req.CustomerID
	if customerID == uuid.Nil {
		customerID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	}

	// Look up variants to get locked prices
	type variantInfo struct {
		model  *model.ProductVariant
		reqIdx int
	}
	variants := make(map[uuid.UUID]*model.ProductVariant, len(req.Items))
	for _, it := range req.Items {
		v, err := s.variantRepo.GetByID(ctx, it.VariantID)
		if err != nil {
			return nil, fmt.Errorf("variant %s not found", it.VariantID)
		}
		if !v.IsActive {
			return nil, fmt.Errorf("variant %s (SKU %s) is not available", v.ID, v.SKU)
		}
		variants[it.VariantID] = v
	}

	// Calculate totals
	saleID := uuid.New()
	ref := fmt.Sprintf("TXN-%s-%d", time.Now().Format("060102"), time.Now().UnixMilli()%10000)

	var subtotal, totalDiscount int64
	saleItems := make([]model.SaleItem, 0, len(req.Items))
	for _, it := range req.Items {
		v := variants[it.VariantID]
		itemTotal := v.SellingPriceKobo*int64(it.Quantity) - it.DiscountKobo
		if itemTotal < 0 {
			itemTotal = 0
		}
		subtotal += v.SellingPriceKobo * int64(it.Quantity)
		totalDiscount += it.DiscountKobo
		saleItems = append(saleItems, model.SaleItem{
			ID:              uuid.New(),
			SaleID:          saleID,
			VariantID:       it.VariantID,
			Quantity:        it.Quantity,
			UnitPriceKobo:   v.SellingPriceKobo, // price LOCKED at sale time
			UnitCostKobo:    v.CostPriceKobo,     // cost LOCKED at sale time
			DiscountKobo:    it.DiscountKobo,
			TotalPriceKobo:  itemTotal,
		})
	}

	grandTotal := subtotal - totalDiscount
	var totalPaid int64
	for _, p := range req.Payments {
		totalPaid += p.AmountKobo
	}
	payStatus := "unpaid"
	if totalPaid >= grandTotal {
		payStatus = "paid"
	} else if totalPaid > 0 {
		payStatus = "partial"
	}

	sale := &model.Sale{
		ID:             saleID,
		Reference:      ref,
		CustomerID:     customerID,
		ServedBy:       servedBy,
		SubtotalKobo:   subtotal,
		DiscountKobo:   totalDiscount,
		TotalKobo:      grandTotal,
		AmountPaidKobo: totalPaid,
		PaymentStatus:  payStatus,
		Status:         "completed",
		SaleChannel:    "physical",
	}
	if req.Notes != "" {
		sale.Notes = &req.Notes
	}

	// ---- Atomic transaction ----
	var txErr error
	tx, err := s.saleRepo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if txErr != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	// Insert sale record
	if txErr = s.saleRepo.CreateSaleTx(ctx, tx, sale); txErr != nil {
		return nil, fmt.Errorf("create sale: %w", txErr)
	}

	// Deduct stock for each item (SELECT FOR UPDATE inside)
	for i := range saleItems {
		si := &saleItems[i]
		before, after, stockErr := s.variantRepo.DeductStockTx(ctx, tx, si.VariantID, si.Quantity)
		if stockErr != nil {
			if errors.Is(stockErr, repository.ErrInsufficientStock) {
				v := variants[si.VariantID]
				txErr = fmt.Errorf("insufficient stock for SKU %s (available: %d, requested: %d)", v.SKU, before, si.Quantity)
				return nil, txErr
			}
			txErr = stockErr
			return nil, txErr
		}

		// Record inventory movement
		refType := "sale"
		reason := fmt.Sprintf("Sale %s", ref)
		if txErr = s.invRepo.RecordMovementTx(ctx, tx, &model.InventoryMovement{
			ID:             uuid.New(),
			VariantID:      si.VariantID,
			MovementType:   "sale",
			Quantity:       -si.Quantity,
			QuantityBefore: before,
			QuantityAfter:  after,
			Reason:         &reason,
			ReferenceType:  &refType,
			ReferenceID:    &saleID,
			PerformedBy:    servedBy,
		}); txErr != nil {
			return nil, txErr
		}

		// Insert sale item
		if txErr = s.saleRepo.CreateSaleItemTx(ctx, tx, si); txErr != nil {
			return nil, txErr
		}
	}

	// Insert payment records
	for _, pr := range req.Payments {
		p := &model.Payment{
			ID:            uuid.New(),
			SaleID:        saleID,
			AmountKobo:    pr.AmountKobo,
			PaymentMethod: pr.Method,
			RecordedBy:    servedBy,
		}
		if pr.Reference != "" {
			p.Reference = &pr.Reference
		}
		if txErr = s.saleRepo.CreatePaymentTx(ctx, tx, p); txErr != nil {
			return nil, txErr
		}
	}

	if txErr = tx.Commit(ctx); txErr != nil {
		return nil, fmt.Errorf("commit: %w", txErr)
	}

	sale.Items = saleItems
	return sale, nil
}

// ReverseSale marks a sale as reversed and restores inventory.
func (s *SaleService) ReverseSale(ctx context.Context, saleID uuid.UUID, reason string, performedBy uuid.UUID) error {
	sale, err := s.saleRepo.GetByID(ctx, saleID)
	if err != nil {
		return err
	}
	if sale.Status != "completed" {
		return fmt.Errorf("sale %s is not in a completed state", sale.Reference)
	}

	tx, err := s.saleRepo.BeginTx(ctx)
	if err != nil {
		return err
	}
	var txErr error
	defer func() {
		if txErr != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	// Mark sale reversed
	if txErr = s.saleRepo.UpdateStatusTx(ctx, tx, saleID, "reversed", sale.PaymentStatus, sale.AmountPaidKobo); txErr != nil {
		return txErr
	}

	// Restore stock for each item
	for _, si := range sale.Items {
		before, after, stockErr := s.variantRepo.AddStockTx(ctx, tx, si.VariantID, si.Quantity)
		if stockErr != nil {
			txErr = stockErr
			return txErr
		}
		refType := "reversal"
		movReason := fmt.Sprintf("Sale reversal: %s. Reason: %s", sale.Reference, reason)
		if txErr = s.invRepo.RecordMovementTx(ctx, tx, &model.InventoryMovement{
			ID:             uuid.New(),
			VariantID:      si.VariantID,
			MovementType:   "adjustment_add",
			Quantity:       si.Quantity,
			QuantityBefore: before,
			QuantityAfter:  after,
			Reason:         &movReason,
			ReferenceType:  &refType,
			ReferenceID:    &saleID,
			PerformedBy:    performedBy,
		}); txErr != nil {
			return txErr
		}
	}

	return tx.Commit(ctx)
}
