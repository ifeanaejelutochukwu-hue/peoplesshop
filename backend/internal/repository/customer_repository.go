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

type CustomerRepository struct {
	db *pgxpool.Pool
}

func NewCustomerRepository(db *pgxpool.Pool) *CustomerRepository {
	return &CustomerRepository{db: db}
}

func (r *CustomerRepository) List(ctx context.Context, limit, offset int, search string) ([]*model.Customer, int64, error) {
	where := []string{"deleted_at IS NULL", "is_walk_in = FALSE"}
	args := []interface{}{}
	i := 1
	if search != "" {
		where = append(where, fmt.Sprintf("(full_name ILIKE $%d OR phone ILIKE $%d)", i, i))
		args = append(args, "%"+search+"%")
		i++
	}
	ws := strings.Join(where, " AND ")

	var total int64
	ca := make([]interface{}, len(args))
	copy(ca, args)
	if err := r.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM customers WHERE %s", ws), ca...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT id, full_name, phone, email, address, notes, is_walk_in, created_at, updated_at
		FROM customers WHERE %s ORDER BY full_name LIMIT $%d OFFSET $%d
	`, ws, i, i+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var customers []*model.Customer
	for rows.Next() {
		c := &model.Customer{}
		if err := rows.Scan(&c.ID, &c.FullName, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.IsWalkIn, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		customers = append(customers, c)
	}
	return customers, total, rows.Err()
}

func (r *CustomerRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Customer, error) {
	c := &model.Customer{}
	err := r.db.QueryRow(ctx, `
		SELECT id, full_name, phone, email, address, notes, is_walk_in, created_at, updated_at
		FROM customers WHERE id=$1 AND deleted_at IS NULL
	`, id).Scan(&c.ID, &c.FullName, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.IsWalkIn, &c.CreatedAt, &c.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	return c, err
}

func (r *CustomerRepository) Create(ctx context.Context, c *model.Customer, createdBy uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO customers (id, full_name, phone, email, address, notes, is_walk_in, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	`, c.ID, c.FullName, c.Phone, c.Email, c.Address, c.Notes, c.IsWalkIn, createdBy)
	return err
}

func (r *CustomerRepository) Update(ctx context.Context, c *model.Customer) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE customers SET full_name=$1, phone=$2, email=$3, address=$4, notes=$5, updated_at=NOW()
		WHERE id=$6 AND deleted_at IS NULL
	`, c.FullName, c.Phone, c.Email, c.Address, c.Notes, c.ID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// PurchaseHistory returns the total spend and transaction count for a customer.
func (r *CustomerRepository) PurchaseHistory(ctx context.Context, customerID uuid.UUID) (count int64, totalKobo int64, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total_kobo), 0)
		FROM sales WHERE customer_id=$1 AND status='completed'
	`, customerID).Scan(&count, &totalKobo)
	return
}
