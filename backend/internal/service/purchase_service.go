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

type PurchaseService struct {
	purchaseRepo *repository.PurchaseRepository
	variantRepo  *repository.VariantRepository
	invRepo      *repository.InventoryRepository
}

func NewPurchaseService(
	purchaseRepo *repository.PurchaseRepository,
	variantRepo *repository.VariantRepository,
	invRepo *repository.InventoryRepository,
) *PurchaseService {
	return &PurchaseService{purchaseRepo: purchaseRepo, variantRepo: variantRepo, invRepo: invRepo}
}

type CreatePurchaseRequest struct {
	SupplierID       uuid.UUID `json:"supplier_id"`
	PurchaseDate     string    `json:"purchase_date"` // YYYY-MM-DD
	ExpectedDelivery string    `json:"expected_delivery"`
	Notes            string    `json:"notes"`
	DiscountKobo     int64     `json:"discount_kobo"`
	ExtraCostsKobo   int64     `json:"extra_costs_kobo"`
	Items            []struct {
		VariantID    uuid.UUID `json:"variant_id"`
		Quantity     int       `json:"quantity"`
		UnitCostKobo int64     `json:"unit_cost_kobo"`
	} `json:"items"`
}

func (s *PurchaseService) Create(ctx context.Context, req CreatePurchaseRequest, createdBy uuid.UUID) (*model.Purchase, error) {
	if req.SupplierID == uuid.Nil {
		return nil, errors.New("supplier_id is required")
	}
	if len(req.Items) == 0 {
		return nil, errors.New("at least one item is required")
	}

	purchaseID := uuid.New()
	ref := fmt.Sprintf("PO-%s-%d", time.Now().Format("060102"), time.Now().UnixMilli()%10000)

	var subtotal int64
	var purchaseItems []model.PurchaseItem
	for _, it := range req.Items {
		if it.Quantity <= 0 {
			return nil, fmt.Errorf("quantity must be > 0 for item %s", it.VariantID)
		}
		total := int64(it.Quantity) * it.UnitCostKobo
		subtotal += total
		purchaseItems = append(purchaseItems, model.PurchaseItem{
			ID:              uuid.New(),
			PurchaseID:      purchaseID,
			VariantID:       it.VariantID,
			QuantityOrdered: it.Quantity,
			UnitCostKobo:    it.UnitCostKobo,
			TotalCostKobo:   total,
		})
	}

	purchaseDate := time.Now()
	if req.PurchaseDate != "" {
		if t, err := time.Parse("2006-01-02", req.PurchaseDate); err == nil {
			purchaseDate = t
		}
	}

	total := subtotal - req.DiscountKobo + req.ExtraCostsKobo

	p := &model.Purchase{
		ID:             purchaseID,
		Reference:      ref,
		SupplierID:     req.SupplierID,
		PurchaseDate:   purchaseDate,
		Notes:          &req.Notes,
		SubtotalKobo:   subtotal,
		DiscountKobo:   req.DiscountKobo,
		ExtraCostsKobo: req.ExtraCostsKobo,
		TotalKobo:      total,
		PaymentStatus:  "unpaid",
		ReceivingStatus: "pending",
		CreatedBy:      createdBy,
	}
	if req.ExpectedDelivery != "" {
		if t, err := time.Parse("2006-01-02", req.ExpectedDelivery); err == nil {
			p.ExpectedDelivery = &t
		}
	}

	if err := s.purchaseRepo.Create(ctx, p); err != nil {
		return nil, fmt.Errorf("create purchase: %w", err)
	}
	for i := range purchaseItems {
		if err := s.purchaseRepo.CreateItem(ctx, &purchaseItems[i]); err != nil {
			return nil, fmt.Errorf("create purchase item: %w", err)
		}
	}
	p.Items = purchaseItems
	return p, nil
}

type ReceiveItemRequest struct {
	ItemID      uuid.UUID `json:"item_id"`
	QtyReceived int       `json:"qty_received"`
}

func (s *PurchaseService) ReceiveStock(ctx context.Context, purchaseID uuid.UUID, items []ReceiveItemRequest, performedBy uuid.UUID) error {
	purchase, err := s.purchaseRepo.GetByID(ctx, purchaseID)
	if err != nil {
		return err
	}
	if purchase.ReceivingStatus == "received" {
		return errors.New("purchase is already fully received")
	}

	tx, err := s.purchaseRepo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	// Build a map of existing items
	itemMap := map[uuid.UUID]model.PurchaseItem{}
	for _, it := range purchase.Items {
		itemMap[it.ID] = it
	}

	for _, recv := range items {
		if recv.QtyReceived <= 0 {
			continue
		}
		existing, ok := itemMap[recv.ItemID]
		if !ok {
			return fmt.Errorf("purchase item %s not found", recv.ItemID)
		}
		remaining := existing.QuantityOrdered - existing.QuantityReceived
		if recv.QtyReceived > remaining {
			return fmt.Errorf("receiving %d exceeds outstanding qty %d for item %s",
				recv.QtyReceived, remaining, recv.ItemID)
		}

		// Record the receive
		if err = s.purchaseRepo.ReceiveItemsTx(ctx, tx, purchaseID, recv.ItemID, recv.QtyReceived); err != nil {
			return fmt.Errorf("receive item: %w", err)
		}

		// Add stock
		before, after, stockErr := s.variantRepo.AddStockTx(ctx, tx, existing.VariantID, recv.QtyReceived)
		if stockErr != nil {
			return fmt.Errorf("add stock: %w", stockErr)
		}

		// Record movement
		reason := fmt.Sprintf("Received from purchase %s", purchase.Reference)
		refType := "purchase"
		if err = s.invRepo.RecordMovementTx(ctx, tx, &model.InventoryMovement{
			ID:             uuid.New(),
			VariantID:      existing.VariantID,
			MovementType:   "purchase_received",
			Quantity:       recv.QtyReceived,
			QuantityBefore: before,
			QuantityAfter:  after,
			Reason:         &reason,
			ReferenceType:  &refType,
			ReferenceID:    &purchaseID,
			PerformedBy:    performedBy,
		}); err != nil {
			return fmt.Errorf("record movement: %w", err)
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	// Refresh status outside transaction
	_ = s.purchaseRepo.RefreshReceivingStatus(ctx, purchaseID)
	return nil
}
