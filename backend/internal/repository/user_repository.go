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

// UserRepository handles all database operations for users.
type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// GetByUsername retrieves a user by username (case-insensitive).
func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	query := `
		SELECT u.id, u.full_name, u.username, u.email,
		       u.password_hash, u.is_active, u.last_login_at,
		       u.created_at, u.updated_at,
		       ro.id, ro.name, ro.description
		FROM users u
		JOIN roles ro ON ro.id = u.role_id
		WHERE u.username = $1 AND u.deleted_at IS NULL
	`
	row := r.db.QueryRow(ctx, query, username)
	return scanUser(row)
}

// GetByID retrieves a user by ID.
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `
		SELECT u.id, u.full_name, u.username, u.email,
		       u.password_hash, u.is_active, u.last_login_at,
		       u.created_at, u.updated_at,
		       ro.id, ro.name, ro.description
		FROM users u
		JOIN roles ro ON ro.id = u.role_id
		WHERE u.id = $1 AND u.deleted_at IS NULL
	`
	row := r.db.QueryRow(ctx, query, id)
	return scanUser(row)
}

// List returns a paginated list of users.
func (r *UserRepository) List(ctx context.Context, limit, offset int) ([]*model.User, int64, error) {
	var total int64
	countQuery := `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`
	if err := r.db.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	query := `
		SELECT u.id, u.full_name, u.username, u.email,
		       u.password_hash, u.is_active, u.last_login_at,
		       u.created_at, u.updated_at,
		       ro.id, ro.name, ro.description
		FROM users u
		JOIN roles ro ON ro.id = u.role_id
		WHERE u.deleted_at IS NULL
		ORDER BY u.created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []*model.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, rows.Err()
}

// Create inserts a new user.
func (r *UserRepository) Create(ctx context.Context, user *model.User, passwordHash string) error {
	query := `
		INSERT INTO users (id, full_name, username, email, password_hash, role_id, is_active, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
	`
	_, err := r.db.Exec(ctx, query,
		user.ID, user.FullName, user.Username, user.Email,
		passwordHash, user.RoleID, user.IsActive, user.ID,
	)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

// UpdateLastLogin sets the last login timestamp.
func (r *UserRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET last_login_at = NOW() WHERE id = $1`,
		id,
	)
	return err
}

// UpdateStatus activates or deactivates a user.
func (r *UserRepository) UpdateStatus(ctx context.Context, id uuid.UUID, isActive bool) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
		isActive, id,
	)
	return err
}

// UpdatePassword sets a new password hash.
func (r *UserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
		hash, id,
	)
	return err
}

// HasPermission checks whether a user (by ID string) has a named permission.
func (r *UserRepository) HasPermission(ctx context.Context, userID, permission string) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM users u
			JOIN roles ro ON ro.id = u.role_id
			JOIN role_permissions rp ON rp.role_id = ro.id
			JOIN permissions p ON p.id = rp.permission_id
			WHERE u.id = $1::uuid
			  AND p.name = $2
			  AND u.is_active = TRUE
			  AND u.deleted_at IS NULL
		)
	`
	var has bool
	err := r.db.QueryRow(ctx, query, userID, permission).Scan(&has)
	return has, err
}

// GetPermissions returns all permission names for a user.
func (r *UserRepository) GetPermissions(ctx context.Context, userID uuid.UUID) ([]string, error) {
	query := `
		SELECT p.name
		FROM users u
		JOIN roles ro ON ro.id = u.role_id
		JOIN role_permissions rp ON rp.role_id = ro.id
		JOIN permissions p ON p.id = rp.permission_id
		WHERE u.id = $1 AND u.deleted_at IS NULL
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("get permissions: %w", err)
	}
	defer rows.Close()

	var perms []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		perms = append(perms, name)
	}
	return perms, rows.Err()
}

// ---- Refresh Token ----

// SaveRefreshToken stores a hashed refresh token.
func (r *UserRepository) SaveRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	query := `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`
	_, err := r.db.Exec(ctx, query, userID, tokenHash, expiresAt)
	return err
}

// ValidateRefreshToken checks if a hashed token exists, is not revoked and has not expired.
func (r *UserRepository) ValidateRefreshToken(ctx context.Context, tokenHash string) (uuid.UUID, error) {
	var userID uuid.UUID
	query := `
		SELECT user_id FROM refresh_tokens
		WHERE token_hash = $1
		  AND revoked = FALSE
		  AND expires_at > NOW()
	`
	err := r.db.QueryRow(ctx, query, tokenHash).Scan(&userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return uuid.Nil, fmt.Errorf("refresh token not found or expired")
		}
		return uuid.Nil, err
	}
	return userID, nil
}

// RevokeRefreshToken marks a token as revoked.
func (r *UserRepository) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
		tokenHash,
	)
	return err
}

// RevokeAllUserTokens revokes all tokens for a user (logout everywhere).
func (r *UserRepository) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`,
		userID,
	)
	return err
}

// ---- Roles ----

// ListRoles returns all roles.
func (r *UserRepository) ListRoles(ctx context.Context) ([]*model.Role, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, name, description, created_at, updated_at FROM roles ORDER BY id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []*model.Role
	for rows.Next() {
		role := &model.Role{}
		if err := rows.Scan(&role.ID, &role.Name, &role.Description, &role.CreatedAt, &role.UpdatedAt); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

// GetRoleByName returns a role by its name.
func (r *UserRepository) GetRoleByName(ctx context.Context, name string) (*model.Role, error) {
	role := &model.Role{}
	err := r.db.QueryRow(ctx,
		`SELECT id, name, description, created_at, updated_at FROM roles WHERE name = $1`,
		name,
	).Scan(&role.ID, &role.Name, &role.Description, &role.CreatedAt, &role.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return role, nil
}

// ---- Scanner ----

// rowScanner is satisfied by both pgx.Row and pgx.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanUser(row rowScanner) (*model.User, error) {
	u := &model.User{}
	err := row.Scan(
		&u.ID, &u.FullName, &u.Username, &u.Email,
		&u.PasswordHash, &u.IsActive, &u.LastLoginAt,
		&u.CreatedAt, &u.UpdatedAt,
		&u.Role.ID, &u.Role.Name, &u.Role.Description,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan user: %w", err)
	}
	u.RoleID = u.Role.ID
	return u, nil
}
