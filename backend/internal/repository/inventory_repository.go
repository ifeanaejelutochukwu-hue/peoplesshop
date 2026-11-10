package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InventoryRepository struct {
	db *pgxpool.Pool
}

func NewInventoryRepository(db *pgxpool.Pool) *InventoryRepository {
	return &InventoryRepository{db: db}
}

type MovementFilters struct {
	VariantID     *uuid.UUID
	MovementType  string
	ReferenceType string
}

// RecordMovementTx records an inventory movement inside a transaction.
func (r *InventoryRepository) RecordMovementTx(ctx context.Context, tx pgx.Tx, m *model.InventoryMovement) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO inventory_movements
		    (id, variant_id, movement_type, quantity, quantity_before, quantity_after,
		     reason, reference_type, reference_id, performed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`,
		m.ID, m.VariantID, m.MovementType, m.Quantity,
		m.QuantityBefore, m.QuantityAfter,
		m.Reason, m.ReferenceType, m.ReferenceID, m.PerformedBy,
	)
	return err
}

// RecordMovement records an inventory movement outside a transaction.
func (r *InventoryRepository) RecordMovement(ctx context.Context, m *model.InventoryMovement) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO inventory_movements
		    (id, variant_id, movement_type, quantity, quantity_before, quantity_after,
		     reason, reference_type, reference_id, performed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`,
		m.ID, m.VariantID, m.MovementType, m.Quantity,
		m.QuantityBefore, m.QuantityAfter,
		m.Reason, m.ReferenceType, m.ReferenceID, m.PerformedBy,
	)
	return err
}

// ListMovements returns paginated inventory movements.
func (r *InventoryRepository) ListMovements(ctx context.Context, limit, offset int, f MovementFilters) ([]*model.InventoryMovement, error) {
	where := []string{}
	args := []interface{}{}
	i := 1

	if f.VariantID != nil {
		where = append(where, fmt.Sprintf("im.variant_id = $%d", i))
		args = append(args, *f.VariantID)
		i++
	}
	if f.MovementType != "" {
		where = append(where, fmt.Sprintf("im.movement_type = $%d", i))
		args = append(args, f.MovementType)
		i++
	}
	if f.ReferenceType != "" {
		where = append(where, fmt.Sprintf("im.reference_type = $%d", i))
		args = append(args, f.ReferenceType)
		i++
	}

	whereStr := ""
	if len(where) > 0 {
		whereStr = "WHERE " + strings.Join(where, " AND ")
	}

	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT
		    im.id, im.variant_id, im.movement_type, im.quantity,
		    im.quantity_before, im.quantity_after, im.reason,
		    im.reference_type, im.reference_id, im.performed_by, im.created_at,
		    pv.sku, p.name, pv.size, pv.colour,
		    u.full_name
		FROM inventory_movements im
		JOIN product_variants pv ON pv.id = im.variant_id
		JOIN products p ON p.id = pv.product_id
		JOIN users u ON u.id = im.performed_by
		%s
		ORDER BY im.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereStr, i, i+1)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list movements: %w", err)
	}
	defer rows.Close()

	var movements []*model.InventoryMovement
	for rows.Next() {
		m := &model.InventoryMovement{}
		m.Variant = &model.ProductVariant{}
		m.PerformedByUser = &model.User{}
		var productName, size, colour string

		if err := rows.Scan(
			&m.ID, &m.VariantID, &m.MovementType, &m.Quantity,
			&m.QuantityBefore, &m.QuantityAfter, &m.Reason,
			&m.ReferenceType, &m.ReferenceID, &m.PerformedBy, &m.CreatedAt,
			&m.Variant.SKU, &productName, &size, &colour,
			&m.PerformedByUser.FullName,
		); err != nil {
			return nil, err
		}
		m.Variant.Size = &size
		m.Variant.Colour = &colour
		m.PerformedByUser.ID = m.PerformedBy
		movements = append(movements, m)
	}
	return movements, rows.Err()
}

// CountMovements returns total movement count for a given filter.
func (r *InventoryRepository) CountMovements(ctx context.Context, f MovementFilters) (int64, error) {
	where := []string{}
	args := []interface{}{}
	i := 1

	if f.VariantID != nil {
		where = append(where, fmt.Sprintf("variant_id = $%d", i))
		args = append(args, *f.VariantID)
		i++
	}

	whereStr := ""
	if len(where) > 0 {
		whereStr = "WHERE " + strings.Join(where, " AND ")
	}

	var count int64
	err := r.db.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM inventory_movements %s`, whereStr),
		args...,
	).Scan(&count)
	return count, err
}

// GetInventoryOverview returns all active variants with stock info.
func (r *InventoryRepository) GetInventoryOverview(ctx context.Context, limit, offset int, search, stockStatus string) ([]*model.ProductVariant, int64, error) {
	where := []string{"pv.deleted_at IS NULL", "pv.is_active = TRUE"}
	args := []interface{}{}
	i := 1

	if search != "" {
		where = append(where, fmt.Sprintf("(p.name ILIKE $%d OR pv.sku ILIKE $%d)", i, i))
		args = append(args, "%"+search+"%")
		i++
	}
	if stockStatus == "out_of_stock" {
		where = append(where, "pv.stock_quantity = 0")
	} else if stockStatus == "low_stock" {
		where = append(where, "pv.stock_quantity > 0 AND pv.stock_quantity <= pv.low_stock_threshold")
	} else if stockStatus == "in_stock" {
		where = append(where, "pv.stock_quantity > pv.low_stock_threshold")
	}

	whereStr := strings.Join(where, " AND ")

	var total int64
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.db.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE %s`, whereStr),
		countArgs...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT
		    pv.id, pv.product_id, pv.sku, pv.barcode, pv.size, pv.colour,
		    pv.selling_price_kobo, pv.cost_price_kobo, pv.stock_quantity,
		    pv.low_stock_threshold, pv.is_active, pv.created_at, pv.updated_at,
		    p.name, p.image_url,
		    c.name AS category_name
		FROM product_variants pv
		JOIN products p ON p.id = pv.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE %s
		ORDER BY pv.stock_quantity ASC, p.name
		LIMIT $%d OFFSET $%d
	`, whereStr, i, i+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var variants []*model.ProductVariant
	for rows.Next() {
		v := &model.ProductVariant{}
		v.Product = &model.Product{}
		var catName *string
		if err := rows.Scan(
			&v.ID, &v.ProductID, &v.SKU, &v.Barcode, &v.Size, &v.Colour,
			&v.SellingPriceKobo, &v.CostPriceKobo, &v.StockQuantity,
			&v.LowStockThreshold, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
			&v.Product.Name, &v.Product.ImageURL,
			&catName,
		); err != nil {
			return nil, 0, err
		}
		if catName != nil {
			v.Product.Category = &model.Category{Name: *catName}
		}
		v.StockStatus = v.ComputeStockStatus()
		variants = append(variants, v)
	}
	return variants, total, rows.Err()
}
