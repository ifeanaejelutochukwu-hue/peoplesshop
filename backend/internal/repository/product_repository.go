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

type ProductRepository struct {
	db *pgxpool.Pool
}

func NewProductRepository(db *pgxpool.Pool) *ProductRepository {
	return &ProductRepository{db: db}
}

type ProductFilters struct {
	Search     string
	CategoryID *int
	Brand      string
	IsActive   *bool
	SupplierID *uuid.UUID
}

// List returns a paginated, filtered list of products with their variants.
func (r *ProductRepository) List(ctx context.Context, limit, offset int, f ProductFilters) ([]*model.Product, int64, error) {
	args := []interface{}{}
	where := []string{"p.deleted_at IS NULL"}
	i := 1

	if f.Search != "" {
		where = append(where, fmt.Sprintf("p.name ILIKE $%d", i))
		args = append(args, "%"+f.Search+"%")
		i++
	}
	if f.CategoryID != nil {
		where = append(where, fmt.Sprintf("p.category_id = $%d", i))
		args = append(args, *f.CategoryID)
		i++
	}
	if f.Brand != "" {
		where = append(where, fmt.Sprintf("p.brand ILIKE $%d", i))
		args = append(args, "%"+f.Brand+"%")
		i++
	}
	if f.IsActive != nil {
		where = append(where, fmt.Sprintf("p.is_active = $%d", i))
		args = append(args, *f.IsActive)
		i++
	}
	if f.SupplierID != nil {
		where = append(where, fmt.Sprintf("p.supplier_id = $%d", i))
		args = append(args, *f.SupplierID)
		i++
	}

	whereStr := strings.Join(where, " AND ")

	var total int64
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := r.db.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM products p WHERE %s`, whereStr), countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT
		    p.id, p.name, p.description, p.category_id, p.brand,
		    p.image_url, p.supplier_id, p.is_active, p.created_at, p.updated_at,
		    c.id, c.name,
		    COALESCE(SUM(pv.stock_quantity), 0) AS total_stock
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
		WHERE %s
		GROUP BY p.id, c.id
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereStr, i, i+1)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list products: %w", err)
	}
	defer rows.Close()

	var products []*model.Product
	for rows.Next() {
		p := &model.Product{}
		var catID *int
		var catName *string
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.CategoryID, &p.Brand,
			&p.ImageURL, &p.SupplierID, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
			&catID, &catName,
			&p.TotalStockUnits,
		); err != nil {
			return nil, 0, fmt.Errorf("scan product: %w", err)
		}
		if catID != nil && catName != nil {
			p.Category = &model.Category{ID: *catID, Name: *catName}
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return products, total, nil
}

// GetByID returns a single product with its variants.
func (r *ProductRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Product, error) {
	p := &model.Product{}
	var catID *int
	var catName *string

	err := r.db.QueryRow(ctx, `
		SELECT
		    p.id, p.name, p.description, p.category_id, p.brand,
		    p.image_url, p.supplier_id, p.is_active, p.created_at, p.updated_at,
		    c.id, c.name
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE p.id = $1 AND p.deleted_at IS NULL
	`, id).Scan(
		&p.ID, &p.Name, &p.Description, &p.CategoryID, &p.Brand,
		&p.ImageURL, &p.SupplierID, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
		&catID, &catName,
	)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if catID != nil && catName != nil {
		p.Category = &model.Category{ID: *catID, Name: *catName}
	}

	variants, err := r.listVariantsByProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	p.Variants = variants
	return p, nil
}

func (r *ProductRepository) listVariantsByProduct(ctx context.Context, productID uuid.UUID) ([]model.ProductVariant, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, product_id, sku, barcode, size, colour,
		       selling_price_kobo, cost_price_kobo, stock_quantity,
		       low_stock_threshold, is_active, created_at, updated_at
		FROM product_variants
		WHERE product_id = $1 AND deleted_at IS NULL
		ORDER BY size, colour
	`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var variants []model.ProductVariant
	for rows.Next() {
		v := model.ProductVariant{}
		if err := rows.Scan(
			&v.ID, &v.ProductID, &v.SKU, &v.Barcode, &v.Size, &v.Colour,
			&v.SellingPriceKobo, &v.CostPriceKobo, &v.StockQuantity,
			&v.LowStockThreshold, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
		); err != nil {
			return nil, err
		}
		v.StockStatus = v.ComputeStockStatus()
		variants = append(variants, v)
	}
	return variants, rows.Err()
}

// Create inserts a new product.
func (r *ProductRepository) Create(ctx context.Context, p *model.Product, createdBy uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO products (id, name, description, category_id, brand, image_url, supplier_id, is_active, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`,
		p.ID, p.Name, p.Description, p.CategoryID, p.Brand,
		p.ImageURL, p.SupplierID, p.IsActive, createdBy,
	)
	return err
}

// Update modifies a product.
func (r *ProductRepository) Update(ctx context.Context, p *model.Product) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE products SET
		    name = $1, description = $2, category_id = $3, brand = $4,
		    image_url = $5, supplier_id = $6, is_active = $7, updated_at = NOW()
		WHERE id = $8 AND deleted_at IS NULL
	`,
		p.Name, p.Description, p.CategoryID, p.Brand,
		p.ImageURL, p.SupplierID, p.IsActive, p.ID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SoftDelete archives a product.
func (r *ProductRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE products SET deleted_at = NOW(), is_active = FALSE WHERE id = $1 AND deleted_at IS NULL`, id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
