package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/repository"
)

type AuditHandler struct {
	auditRepo *repository.AuditRepository
}

func NewAuditHandler(auditRepo *repository.AuditRepository) *AuditHandler {
	return &AuditHandler{auditRepo: auditRepo}
}

// List GET /api/v1/audit-logs
func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)

	logs, total, err := h.auditRepo.List(r.Context(), pageSize, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to retrieve audit logs")
		return
	}
	WritePaginated(w, logs, total, page, pageSize)
}
