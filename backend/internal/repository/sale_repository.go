package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SaleRepository struct {
	db *pgxpool.Pool
}

func NewSaleRepository(db *pgxpool.Pool) *SaleRepository {
	return &SaleRepository{db: db}
}

type SaleFilters struct {
	Search        string
	DateFrom      *time.Time
	DateTo        *time.Time
	PaymentStatus string
	Status        string
	ServedBy      *uuid.UUID
	CustomerID    *uuid.UUID
}

func (r *SaleRepository) List(ctx context.Context, limit, offset int, f SaleFilters) ([]*model.Sale, error) {
	where := []string{"s.status != 'cancelled'"}
	args := []interface{}{}
	i := 1

	if f.Search != "" {
		where = append(where, fmt.Sprintf("s.reference ILIKE $%d", i))
		args = append(args, "%"+f.Search+"%")
		i++
	}
	if f.DateFrom != nil {
		where = append(where, fmt.Sprintf("s.created_at >= $%d", i))
		args = append(args, *f.DateFrom)
		i++
	}
	if f.DateTo != nil {
		where = append(where, fmt.Sprintf("s.created_at <= $%d", i))
		args = append(args, *f.DateTo)
		i++
	}
	if f.PaymentStatus != "" {
		where = append(where, fmt.Sprintf("s.payment_status = $%d", i))
		args = append(args, f.PaymentStatus)
		i++
	}
	if f.Status != "" {
		where = append(where, fmt.Sprintf("s.status = $%d", i))
		args = append(args, f.Status)
		i++
	}
	if f.ServedBy != nil {
		where = append(where, fmt.Sprintf("s.served_by = $%d", i))
		args = append(args, *f.ServedBy)
		i++
	}

	whereStr := strings.Join(where, " AND ")
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT
		    s.id, s.reference, s.customer_id, s.served_by,
		    s.subtotal_kobo, s.discount_kobo, s.tax_kobo, s.total_kobo,
		    s.amount_paid_kobo, s.payment_status, s.status,
		    s.notes, s.sale_channel, s.created_at, s.updated_at,
		    c.full_name AS customer_name,
		    u.full_name AS served_by_name
		FROM sales s
		LEFT JOIN customers c ON c.id = s.customer_id
		JOIN users u ON u.id = s.served_by
		WHERE %s
		ORDER BY s.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereStr, i, i+1), args...)
	if err != nil {
		return nil, fmt.Errorf("list sales: %w", err)
	}
	defer rows.Close()

	var sales []*model.Sale
	for rows.Next() {
		s := &model.Sale{}
		var customerName, servedByName string
		if err := rows.Scan(
			&s.ID, &s.Reference, &s.CustomerID, &s.ServedBy,
			&s.SubtotalKobo, &s.DiscountKobo, &s.TaxKobo, &s.TotalKobo,
			&s.AmountPaidKobo, &s.PaymentStatus, &s.Status,
			&s.Notes, &s.SaleChannel, &s.CreatedAt, &s.UpdatedAt,
			&customerName, &servedByName,
		); err != nil {
			return nil, err
		}
		s.Customer = &model.Customer{ID: s.CustomerID, FullName: customerName}
		s.ServedByUser = &model.User{ID: s.ServedBy, FullName: servedByName}
		sales = append(sales, s)
	}
	return sales, rows.Err()
}

func (r *SaleRepository) Count(ctx context.Context, f SaleFilters) (int64, error) {
	where := []string{"s.status != 'cancelled'"}
	args := []interface{}{}
	i := 1

	if f.Search != "" {
		where = append(where, fmt.Sprintf("s.reference ILIKE $%d", i))
		args = append(args, "%"+f.Search+"%")
		i++
	}
	if f.ServedBy != nil {
		where = append(where, fmt.Sprintf("s.served_by = $%d", i))
		args = append(args, *f.ServedBy)
		i++
	}

	var count int64
	err := r.db.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM sales s WHERE %s`, strings.Join(where, " AND ")),
		args...,
	).Scan(&count)
	return count, err
}

func (r *SaleRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Sale, error) {
	s := &model.Sale{}
	var customerName, servedByName string

	err := r.db.QueryRow(ctx, `
		SELECT
		    s.id, s.reference, s.customer_id, s.served_by,
		    s.subtotal_kobo, s.discount_kobo, s.tax_kobo, s.total_kobo,
		    s.amount_paid_kobo, s.payment_status, s.status,
		    s.notes, s.sale_channel, s.created_at, s.updated_at,
		    c.full_name, u.full_name
		FROM sales s
		LEFT JOIN customers c ON c.id = s.customer_id
		JOIN users u ON u.id = s.served_by
		WHERE s.id = $1
	`, id).Scan(
		&s.ID, &s.Reference, &s.CustomerID, &s.ServedBy,
		&s.SubtotalKobo, &s.DiscountKobo, &s.TaxKobo, &s.TotalKobo,
		&s.AmountPaidKobo, &s.PaymentStatus, &s.Status,
		&s.Notes, &s.SaleChannel, &s.CreatedAt, &s.UpdatedAt,
		&customerName, &servedByName,
	)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	s.Customer = &model.Customer{ID: s.CustomerID, FullName: customerName}
	s.ServedByUser = &model.User{ID: s.ServedBy, FullName: servedByName}

	// Load items
	items, err := r.loadItems(ctx, id)
	if err != nil {
		return nil, err
	}
	s.Items = items

	// Load payments
	payments, err := r.loadPayments(ctx, id)
	if err != nil {
		return nil, err
	}
	s.Payments = payments

	return s, nil
}

func (r *SaleRepository) loadItems(ctx context.Context, saleID uuid.UUID) ([]model.SaleItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		    si.id, si.sale_id, si.variant_id, si.quantity,
		    si.unit_price_kobo, si.unit_cost_kobo, si.discount_kobo, si.total_price_kobo, si.created_at,
		    pv.sku, pv.size, pv.colour, p.name, p.image_url
		FROM sale_items si
		JOIN product_variants pv ON pv.id = si.variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE si.sale_id = $1
	`, saleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.SaleItem
	for rows.Next() {
		si := model.SaleItem{}
		si.Variant = &model.ProductVariant{Product: &model.Product{}}
		var size, colour *string
		if err := rows.Scan(
			&si.ID, &si.SaleID, &si.VariantID, &si.Quantity,
			&si.UnitPriceKobo, &si.UnitCostKobo, &si.DiscountKobo, &si.TotalPriceKobo, &si.CreatedAt,
			&si.Variant.SKU, &size, &colour, &si.Variant.Product.Name, &si.Variant.Product.ImageURL,
		); err != nil {
			return nil, err
		}
		si.Variant.Size = size
		si.Variant.Colour = colour
		items = append(items, si)
	}
	return items, rows.Err()
}

func (r *SaleRepository) loadPayments(ctx context.Context, saleID uuid.UUID) ([]model.Payment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, sale_id, amount_kobo, payment_method, reference, notes, recorded_by, created_at
		FROM payments WHERE sale_id = $1 ORDER BY created_at
	`, saleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []model.Payment
	for rows.Next() {
		p := model.Payment{}
		if err := rows.Scan(&p.ID, &p.SaleID, &p.AmountKobo, &p.PaymentMethod,
			&p.Reference, &p.Notes, &p.RecordedBy, &p.CreatedAt); err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}
	return payments, rows.Err()
}

// CreateSaleTx creates a complete sale atomically.
func (r *SaleRepository) CreateSaleTx(ctx context.Context, tx pgx.Tx, s *model.Sale) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO sales
		    (id, reference, customer_id, served_by, subtotal_kobo, discount_kobo,
		     tax_kobo, total_kobo, amount_paid_kobo, payment_status, status, notes, sale_channel)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		s.ID, s.Reference, s.CustomerID, s.ServedBy,
		s.SubtotalKobo, s.DiscountKobo, s.TaxKobo, s.TotalKobo,
		s.AmountPaidKobo, s.PaymentStatus, s.Status, s.Notes, s.SaleChannel,
	)
	return err
}

func (r *SaleRepository) CreateSaleItemTx(ctx context.Context, tx pgx.Tx, si *model.SaleItem) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO sale_items
		    (id, sale_id, variant_id, quantity, unit_price_kobo, unit_cost_kobo, discount_kobo, total_price_kobo)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`,
		si.ID, si.SaleID, si.VariantID, si.Quantity,
		si.UnitPriceKobo, si.UnitCostKobo, si.DiscountKobo, si.TotalPriceKobo,
	)
	return err
}

func (r *SaleRepository) CreatePaymentTx(ctx context.Context, tx pgx.Tx, p *model.Payment) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO payments (id, sale_id, amount_kobo, payment_method, reference, notes, recorded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`,
		p.ID, p.SaleID, p.AmountKobo, p.PaymentMethod, p.Reference, p.Notes, p.RecordedBy,
	)
	return err
}

func (r *SaleRepository) UpdateStatusTx(ctx context.Context, tx pgx.Tx, saleID uuid.UUID, status, paymentStatus string, amountPaid int64) error {
	_, err := tx.Exec(ctx, `
		UPDATE sales SET status = $1, payment_status = $2, amount_paid_kobo = $3, updated_at = NOW()
		WHERE id = $4
	`, status, paymentStatus, amountPaid, saleID)
	return err
}

// BeginTx starts a new database transaction.
func (r *SaleRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}
