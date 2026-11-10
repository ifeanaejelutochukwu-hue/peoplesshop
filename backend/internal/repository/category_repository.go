package repository

import (
	"context"
	"fmt"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CategoryRepository struct {
	db *pgxpool.Pool
}

func NewCategoryRepository(db *pgxpool.Pool) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) List(ctx context.Context) ([]*model.Category, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, name, description, created_at, updated_at FROM categories WHERE deleted_at IS NULL ORDER BY name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cats []*model.Category
	for rows.Next() {
		c := &model.Category{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

func (r *CategoryRepository) GetByID(ctx context.Context, id int) (*model.Category, error) {
	c := &model.Category{}
	err := r.db.QueryRow(ctx,
		`SELECT id, name, description, created_at, updated_at FROM categories WHERE id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	return c, err
}

func (r *CategoryRepository) Create(ctx context.Context, name, description string) (*model.Category, error) {
	c := &model.Category{}
	err := r.db.QueryRow(ctx,
		`INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at, updated_at`,
		name, description,
	).Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create category: %w", err)
	}
	return c, nil
}

func (r *CategoryRepository) Update(ctx context.Context, id int, name, description string) (*model.Category, error) {
	c := &model.Category{}
	err := r.db.QueryRow(ctx,
		`UPDATE categories SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND deleted_at IS NULL RETURNING id, name, description, created_at, updated_at`,
		name, description, id,
	).Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	return c, err
}

func (r *CategoryRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`, id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
