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

type SupplierRepository struct {
	db *pgxpool.Pool
}

func NewSupplierRepository(db *pgxpool.Pool) *SupplierRepository {
	return &SupplierRepository{db: db}
}

func (r *SupplierRepository) List(ctx context.Context, limit, offset int, search string) ([]*model.Supplier, int64, error) {
	where := []string{"deleted_at IS NULL"}
	args := []interface{}{}
	i := 1
	if search != "" {
		where = append(where, fmt.Sprintf("name ILIKE $%d", i))
		args = append(args, "%"+search+"%")
		i++
	}
	whereStr := strings.Join(where, " AND ")

	var total int64
	cArgs := make([]interface{}, len(args))
	copy(cArgs, args)
	if err := r.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM suppliers WHERE %s", whereStr), cArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT id, name, contact_person, phone, email, address, description, notes, is_active, created_at, updated_at
		FROM suppliers WHERE %s ORDER BY name LIMIT $%d OFFSET $%d
	`, whereStr, i, i+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var suppliers []*model.Supplier
	for rows.Next() {
		s := &model.Supplier{}
		if err := rows.Scan(&s.ID, &s.Name, &s.ContactPerson, &s.Phone, &s.Email, &s.Address,
			&s.Description, &s.Notes, &s.IsActive, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, 0, err
		}
		suppliers = append(suppliers, s)
	}
	return suppliers, total, rows.Err()
}

func (r *SupplierRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Supplier, error) {
	s := &model.Supplier{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, contact_person, phone, email, address, description, notes, is_active, created_at, updated_at
		FROM suppliers WHERE id = $1 AND deleted_at IS NULL
	`, id).Scan(&s.ID, &s.Name, &s.ContactPerson, &s.Phone, &s.Email, &s.Address,
		&s.Description, &s.Notes, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	return s, err
}

func (r *SupplierRepository) Create(ctx context.Context, s *model.Supplier, createdBy uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO suppliers (id, name, contact_person, phone, email, address, description, notes, is_active, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, s.ID, s.Name, s.ContactPerson, s.Phone, s.Email, s.Address, s.Description, s.Notes, s.IsActive, createdBy)
	return err
}

func (r *SupplierRepository) Update(ctx context.Context, s *model.Supplier) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE suppliers SET name=$1, contact_person=$2, phone=$3, email=$4, address=$5,
		    description=$6, notes=$7, is_active=$8, updated_at=NOW()
		WHERE id=$9 AND deleted_at IS NULL
	`, s.Name, s.ContactPerson, s.Phone, s.Email, s.Address,
		s.Description, s.Notes, s.IsActive, s.ID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
