package repository

import (
	"context"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PurchaseRepository struct {
	db *pgxpool.Pool
}

func NewPurchaseRepository(db *pgxpool.Pool) *PurchaseRepository {
	return &PurchaseRepository{db: db}
}

func (r *PurchaseRepository) List(ctx context.Context, limit, offset int) ([]*model.Purchase, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM purchases`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.reference, p.supplier_id, p.purchase_date, p.expected_delivery,
		       p.notes, p.subtotal_kobo, p.discount_kobo, p.extra_costs_kobo, p.total_kobo,
		       p.amount_paid_kobo, p.payment_status, p.receiving_status,
		       p.created_by, p.created_at, p.updated_at,
		       s.name AS supplier_name
		FROM purchases p
		JOIN suppliers s ON s.id = p.supplier_id
		ORDER BY p.created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var purchases []*model.Purchase
	for rows.Next() {
		p := &model.Purchase{}
		var supplierName string
		if err := rows.Scan(
			&p.ID, &p.Reference, &p.SupplierID, &p.PurchaseDate, &p.ExpectedDelivery,
			&p.Notes, &p.SubtotalKobo, &p.DiscountKobo, &p.ExtraCostsKobo, &p.TotalKobo,
			&p.AmountPaidKobo, &p.PaymentStatus, &p.ReceivingStatus,
			&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
			&supplierName,
		); err != nil {
			return nil, 0, err
		}
		p.Supplier = &model.Supplier{ID: p.SupplierID, Name: supplierName}
		purchases = append(purchases, p)
	}
	return purchases, total, rows.Err()
}

func (r *PurchaseRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Purchase, error) {
	p := &model.Purchase{}
	var supplierName string
	err := r.db.QueryRow(ctx, `
		SELECT p.id, p.reference, p.supplier_id, p.purchase_date, p.expected_delivery,
		       p.notes, p.subtotal_kobo, p.discount_kobo, p.extra_costs_kobo, p.total_kobo,
		       p.amount_paid_kobo, p.payment_status, p.receiving_status,
		       p.created_by, p.created_at, p.updated_at, s.name
		FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
		WHERE p.id=$1
	`, id).Scan(
		&p.ID, &p.Reference, &p.SupplierID, &p.PurchaseDate, &p.ExpectedDelivery,
		&p.Notes, &p.SubtotalKobo, &p.DiscountKobo, &p.ExtraCostsKobo, &p.TotalKobo,
		&p.AmountPaidKobo, &p.PaymentStatus, &p.ReceivingStatus,
		&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt, &supplierName,
	)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	p.Supplier = &model.Supplier{ID: p.SupplierID, Name: supplierName}

	// Load items
	rows, err := r.db.Query(ctx, `
		SELECT pi.id, pi.purchase_id, pi.variant_id, pi.quantity_ordered, pi.quantity_received,
		       pi.unit_cost_kobo, pi.total_cost_kobo, pi.created_at, pi.updated_at,
		       pv.sku, pv.size, pv.colour, pr.name
		FROM purchase_items pi
		JOIN product_variants pv ON pv.id=pi.variant_id
		JOIN products pr ON pr.id=pv.product_id
		WHERE pi.purchase_id=$1
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		item := model.PurchaseItem{}
		item.Variant = &model.ProductVariant{Product: &model.Product{}}
		var size, colour *string
		if err := rows.Scan(
			&item.ID, &item.PurchaseID, &item.VariantID,
			&item.QuantityOrdered, &item.QuantityReceived,
			&item.UnitCostKobo, &item.TotalCostKobo, &item.CreatedAt, &item.UpdatedAt,
			&item.Variant.SKU, &size, &colour, &item.Variant.Product.Name,
		); err != nil {
			return nil, err
		}
		item.Variant.Size = size
		item.Variant.Colour = colour
		p.Items = append(p.Items, item)
	}
	return p, rows.Err()
}

func (r *PurchaseRepository) Create(ctx context.Context, p *model.Purchase) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO purchases
		    (id, reference, supplier_id, purchase_date, expected_delivery, notes,
		     subtotal_kobo, discount_kobo, extra_costs_kobo, total_kobo,
		     amount_paid_kobo, payment_status, receiving_status, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
	`, p.ID, p.Reference, p.SupplierID, p.PurchaseDate, p.ExpectedDelivery, p.Notes,
		p.SubtotalKobo, p.DiscountKobo, p.ExtraCostsKobo, p.TotalKobo,
		p.AmountPaidKobo, p.PaymentStatus, p.ReceivingStatus, p.CreatedBy)
	return err
}

func (r *PurchaseRepository) CreateItem(ctx context.Context, item *model.PurchaseItem) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO purchase_items (id, purchase_id, variant_id, quantity_ordered, quantity_received, unit_cost_kobo, total_cost_kobo)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, item.ID, item.PurchaseID, item.VariantID, item.QuantityOrdered, item.QuantityReceived, item.UnitCostKobo, item.TotalCostKobo)
	return err
}

// ReceiveItems records goods received and updates stock.
// This MUST run inside a database transaction.
func (r *PurchaseRepository) ReceiveItemsTx(ctx context.Context, tx pgx.Tx, purchaseID, itemID uuid.UUID, qtyReceived int) error {
	_, err := tx.Exec(ctx, `
		UPDATE purchase_items SET quantity_received = quantity_received + $1, updated_at = NOW()
		WHERE id = $2 AND purchase_id = $3
	`, qtyReceived, itemID, purchaseID)
	return err
}

func (r *PurchaseRepository) UpdateStatusTx(ctx context.Context, tx pgx.Tx, purchaseID uuid.UUID, payStatus, rcvStatus string) error {
	_, err := tx.Exec(ctx, `
		UPDATE purchases SET payment_status=$1, receiving_status=$2, updated_at=NOW() WHERE id=$3
	`, payStatus, rcvStatus, purchaseID)
	return err
}

func (r *PurchaseRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

// RefreshStatus recalculates receiving_status from items and updates.
func (r *PurchaseRepository) RefreshReceivingStatus(ctx context.Context, purchaseID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE purchases SET
		    receiving_status = CASE
		        WHEN NOT EXISTS (SELECT 1 FROM purchase_items WHERE purchase_id=$1 AND quantity_received < quantity_ordered) THEN 'received'
		        WHEN EXISTS     (SELECT 1 FROM purchase_items WHERE purchase_id=$1 AND quantity_received > 0)               THEN 'partial'
		        ELSE 'pending'
		    END,
		    updated_at = NOW()
		WHERE id = $1
	`, purchaseID)
	return err
}
