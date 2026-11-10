package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditRepository struct {
	db *pgxpool.Pool
}

func NewAuditRepository(db *pgxpool.Pool) *AuditRepository {
	return &AuditRepository{db: db}
}

// Log records an audit event.
func (r *AuditRepository) Log(ctx context.Context, entry *AuditEntry) error {
	var oldJSON, newJSON []byte
	var err error

	if entry.OldValues != nil {
		oldJSON, err = json.Marshal(entry.OldValues)
		if err != nil {
			return fmt.Errorf("marshal old values: %w", err)
		}
	}
	if entry.NewValues != nil {
		newJSON, err = json.Marshal(entry.NewValues)
		if err != nil {
			return fmt.Errorf("marshal new values: %w", err)
		}
	}

	query := `
		INSERT INTO audit_logs
		    (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)
	`
	_, err = r.db.Exec(ctx, query,
		entry.UserID, entry.Action, entry.ResourceType, entry.ResourceID,
		oldJSON, newJSON, entry.IPAddress, entry.UserAgent,
	)
	return err
}

// List returns paginated audit logs.
func (r *AuditRepository) List(ctx context.Context, limit, offset int) ([]*model.AuditLog, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT al.id, al.user_id, al.action, al.resource_type, al.resource_id,
		       al.old_values, al.new_values, al.ip_address::text, al.user_agent, al.created_at,
		       u.full_name
		FROM audit_logs al
		LEFT JOIN users u ON u.id = al.user_id
		ORDER BY al.created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []*model.AuditLog
	for rows.Next() {
		l := &model.AuditLog{}
		var fullName *string
		var ipStr, uaStr *string
		if err := rows.Scan(
			&l.ID, &l.UserID, &l.Action, &l.ResourceType, &l.ResourceID,
			&l.OldValues, &l.NewValues, &ipStr, &uaStr, &l.CreatedAt,
			&fullName,
		); err != nil {
			return nil, 0, err
		}
		l.IPAddress = ipStr
		l.UserAgent = uaStr
		if fullName != nil && l.UserID != nil {
			l.User = &model.User{ID: *l.UserID, FullName: *fullName}
		}
		logs = append(logs, l)
	}
	return logs, total, rows.Err()
}

// AuditEntry is the input to the Log function.
type AuditEntry struct {
	UserID       *uuid.UUID
	Action       string
	ResourceType *string
	ResourceID   *string
	OldValues    interface{}
	NewValues    interface{}
	IPAddress    *string
	UserAgent    *string
}
