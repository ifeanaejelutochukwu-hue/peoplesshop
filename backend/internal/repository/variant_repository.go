package repository

import (
	"context"
	"fmt"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type VariantRepository struct {
	db *pgxpool.Pool
}

func NewVariantRepository(db *pgxpool.Pool) *VariantRepository {
	return &VariantRepository{db: db}
}

func (r *VariantRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.ProductVariant, error) {
	v := &model.ProductVariant{}
	err := r.db.QueryRow(ctx, `
		SELECT id, product_id, sku, barcode, size, colour,
		       selling_price_kobo, cost_price_kobo, stock_quantity,
		       low_stock_threshold, is_active, created_at, updated_at
		FROM product_variants
		WHERE id = $1 AND deleted_at IS NULL
	`, id).Scan(
		&v.ID, &v.ProductID, &v.SKU, &v.Barcode, &v.Size, &v.Colour,
		&v.SellingPriceKobo, &v.CostPriceKobo, &v.StockQuantity,
		&v.LowStockThreshold, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	v.StockStatus = v.ComputeStockStatus()
	return v, nil
}

func (r *VariantRepository) GetBySKU(ctx context.Context, sku string) (*model.ProductVariant, error) {
	v := &model.ProductVariant{}
	err := r.db.QueryRow(ctx, `
		SELECT id, product_id, sku, barcode, size, colour,
		       selling_price_kobo, cost_price_kobo, stock_quantity,
		       low_stock_threshold, is_active, created_at, updated_at
		FROM product_variants
		WHERE sku = $1 AND deleted_at IS NULL
	`, sku).Scan(
		&v.ID, &v.ProductID, &v.SKU, &v.Barcode, &v.Size, &v.Colour,
		&v.SellingPriceKobo, &v.CostPriceKobo, &v.StockQuantity,
		&v.LowStockThreshold, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	return v, err
}

// Create inserts a new variant.
func (r *VariantRepository) Create(ctx context.Context, v *model.ProductVariant) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO product_variants
		    (id, product_id, sku, barcode, size, colour,
		     selling_price_kobo, cost_price_kobo, stock_quantity, low_stock_threshold, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`,
		v.ID, v.ProductID, v.SKU, v.Barcode, v.Size, v.Colour,
		v.SellingPriceKobo, v.CostPriceKobo, v.StockQuantity, v.LowStockThreshold, v.IsActive,
	)
	return err
}

// Update modifies a variant's prices and metadata (NOT stock quantity — use inventory methods).
func (r *VariantRepository) Update(ctx context.Context, v *model.ProductVariant) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE product_variants SET
		    sku = $1, barcode = $2, size = $3, colour = $4,
		    selling_price_kobo = $5, cost_price_kobo = $6,
		    low_stock_threshold = $7, is_active = $8, updated_at = NOW()
		WHERE id = $9 AND deleted_at IS NULL
	`,
		v.SKU, v.Barcode, v.Size, v.Colour,
		v.SellingPriceKobo, v.CostPriceKobo,
		v.LowStockThreshold, v.IsActive, v.ID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeductStock reduces stock using SELECT FOR UPDATE to prevent race conditions.
// Must be called inside a database transaction.
func (r *VariantRepository) DeductStockTx(ctx context.Context, tx pgx.Tx, variantID uuid.UUID, quantity int) (quantityBefore, quantityAfter int, err error) {
	err = tx.QueryRow(ctx, `
		SELECT stock_quantity FROM product_variants WHERE id = $1 AND deleted_at IS NULL FOR UPDATE
	`, variantID).Scan(&quantityBefore)
	if err != nil {
		return 0, 0, fmt.Errorf("lock variant: %w", err)
	}

	if quantityBefore < quantity {
		return quantityBefore, quantityBefore, ErrInsufficientStock
	}

	quantityAfter = quantityBefore - quantity
	_, err = tx.Exec(ctx,
		`UPDATE product_variants SET stock_quantity = $1, updated_at = NOW() WHERE id = $2`,
		quantityAfter, variantID,
	)
	return quantityBefore, quantityAfter, err
}

// AddStockTx increases stock inside a transaction.
func (r *VariantRepository) AddStockTx(ctx context.Context, tx pgx.Tx, variantID uuid.UUID, quantity int) (quantityBefore, quantityAfter int, err error) {
	err = tx.QueryRow(ctx, `
		SELECT stock_quantity FROM product_variants WHERE id = $1 AND deleted_at IS NULL FOR UPDATE
	`, variantID).Scan(&quantityBefore)
	if err != nil {
		return 0, 0, fmt.Errorf("lock variant: %w", err)
	}

	quantityAfter = quantityBefore + quantity
	_, err = tx.Exec(ctx,
		`UPDATE product_variants SET stock_quantity = $1, updated_at = NOW() WHERE id = $2`,
		quantityAfter, variantID,
	)
	return quantityBefore, quantityAfter, err
}

// SKUExists checks whether a SKU is already in use.
func (r *VariantRepository) SKUExists(ctx context.Context, sku string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM product_variants WHERE sku = $1 AND deleted_at IS NULL`
	args := []interface{}{sku}
	if excludeID != nil {
		query += ` AND id != $2`
		args = append(args, *excludeID)
	}
	query += `)`

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	return exists, err
}

func (r *VariantRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE product_variants SET deleted_at = NOW(), is_active = FALSE WHERE id = $1 AND deleted_at IS NULL`, id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
