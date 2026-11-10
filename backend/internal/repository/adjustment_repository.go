package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AdjustmentRepository struct {
	db *pgxpool.Pool
}

func NewAdjustmentRepository(db *pgxpool.Pool) *AdjustmentRepository {
	return &AdjustmentRepository{db: db}
}

// CreateAdjustment applies a stock adjustment atomically.
func (r *AdjustmentRepository) CreateAdjustment(
	ctx context.Context,
	variantRepo *VariantRepository,
	invRepo *InventoryRepository,
	variantID uuid.UUID,
	quantity int,
	reason string,
	performedBy uuid.UUID,
) (*model.StockAdjustment, error) {
	if quantity == 0 {
		return nil, fmt.Errorf("adjustment quantity cannot be zero")
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	var before, after int
	var movType string
	if quantity > 0 {
		before, after, err = variantRepo.AddStockTx(ctx, tx, variantID, quantity)
		movType = "adjustment_add"
	} else {
		before, after, err = variantRepo.DeductStockTx(ctx, tx, variantID, -quantity)
		movType = "adjustment_deduct"
	}
	if err != nil {
		return nil, fmt.Errorf("adjust stock: %w", err)
	}

	ref := fmt.Sprintf("ADJ-%s-%d", time.Now().Format("060102"), time.Now().UnixMilli()%10000)
	adjID := uuid.New()

	_, err = tx.Exec(ctx, `
		INSERT INTO stock_adjustments (id, reference, variant_id, quantity, reason, created_by)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, adjID, ref, variantID, quantity, reason, performedBy)
	if err != nil {
		return nil, err
	}

	refType := "adjustment"
	if err = invRepo.RecordMovementTx(ctx, tx, &model.InventoryMovement{
		ID:             uuid.New(),
		VariantID:      variantID,
		MovementType:   movType,
		Quantity:       quantity,
		QuantityBefore: before,
		QuantityAfter:  after,
		Reason:         &reason,
		ReferenceType:  &refType,
		ReferenceID:    &adjID,
		PerformedBy:    performedBy,
	}); err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &model.StockAdjustment{
		ID:        adjID,
		Reference: ref,
		VariantID: variantID,
		Quantity:  quantity,
		Reason:    reason,
		CreatedBy: performedBy,
		CreatedAt: time.Now(),
	}, nil
}

// List returns recent adjustments.
func (r *AdjustmentRepository) List(ctx context.Context, limit, offset int) ([]*model.StockAdjustment, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM stock_adjustments`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT sa.id, sa.reference, sa.variant_id, sa.quantity, sa.reason,
		       sa.created_by, sa.created_at,
		       pv.sku, pv.size, pv.colour, p.name
		FROM stock_adjustments sa
		JOIN product_variants pv ON pv.id = sa.variant_id
		JOIN products p ON p.id = pv.product_id
		ORDER BY sa.created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var adjs []*model.StockAdjustment
	for rows.Next() {
		a := &model.StockAdjustment{Variant: &model.ProductVariant{Product: &model.Product{}}}
		var size, colour *string
		if err := rows.Scan(
			&a.ID, &a.Reference, &a.VariantID, &a.Quantity, &a.Reason,
			&a.CreatedBy, &a.CreatedAt,
			&a.Variant.SKU, &size, &colour, &a.Variant.Product.Name,
		); err != nil {
			return nil, 0, err
		}
		a.Variant.Size = size
		a.Variant.Colour = colour
		adjs = append(adjs, a)
	}
	return adjs, total, rows.Err()
}

// GetPool returns the pool for tx reuse.
func (r *AdjustmentRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}
