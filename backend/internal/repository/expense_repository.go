package repository

import (
	"context"
	"fmt"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ExpenseRepository struct {
	db *pgxpool.Pool
}

func NewExpenseRepository(db *pgxpool.Pool) *ExpenseRepository {
	return &ExpenseRepository{db: db}
}

func (r *ExpenseRepository) ListCategories(ctx context.Context) ([]*model.ExpenseCategory, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name FROM expense_categories WHERE deleted_at IS NULL ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cats []*model.ExpenseCategory
	for rows.Next() {
		c := &model.ExpenseCategory{}
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

func (r *ExpenseRepository) List(ctx context.Context, limit, offset int, categoryID *int) ([]*model.Expense, int64, error) {
	where := "deleted_at IS NULL"
	args := []interface{}{}
	i := 1
	if categoryID != nil {
		where += fmt.Sprintf(" AND expense_category_id = $%d", i)
		args = append(args, *categoryID)
		i++
	}

	var total int64
	ca := make([]interface{}, len(args))
	copy(ca, args)
	if err := r.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM expenses WHERE %s", where), ca...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT e.id, e.expense_category_id, e.description, e.amount_kobo, e.expense_date,
		       e.payment_method, e.notes, e.recorded_by, e.created_at, e.updated_at,
		       ec.name
		FROM expenses e
		JOIN expense_categories ec ON ec.id = e.expense_category_id
		WHERE e.%s ORDER BY e.expense_date DESC, e.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, i, i+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var expenses []*model.Expense
	for rows.Next() {
		e := &model.Expense{ExpenseCategory: &model.ExpenseCategory{}}
		if err := rows.Scan(
			&e.ID, &e.ExpenseCategoryID, &e.Description, &e.AmountKobo, &e.ExpenseDate,
			&e.PaymentMethod, &e.Notes, &e.RecordedBy, &e.CreatedAt, &e.UpdatedAt,
			&e.ExpenseCategory.Name,
		); err != nil {
			return nil, 0, err
		}
		e.ExpenseCategory.ID = e.ExpenseCategoryID
		expenses = append(expenses, e)
	}
	return expenses, total, rows.Err()
}

func (r *ExpenseRepository) Create(ctx context.Context, e *model.Expense) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO expenses (id, expense_category_id, description, amount_kobo, expense_date, payment_method, notes, recorded_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	`, e.ID, e.ExpenseCategoryID, e.Description, e.AmountKobo, e.ExpenseDate, e.PaymentMethod, e.Notes, e.RecordedBy)
	return err
}

func (r *ExpenseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE expenses SET deleted_at=NOW() WHERE id=$1`, id)
	return err
}
