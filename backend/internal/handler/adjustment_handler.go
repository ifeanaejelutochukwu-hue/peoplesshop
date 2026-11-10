package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/google/uuid"
)

type AdjustmentHandler struct {
	adjRepo     *repository.AdjustmentRepository
	variantRepo *repository.VariantRepository
	invRepo     *repository.InventoryRepository
}

func NewAdjustmentHandler(
	adjRepo *repository.AdjustmentRepository,
	variantRepo *repository.VariantRepository,
	invRepo *repository.InventoryRepository,
) *AdjustmentHandler {
	return &AdjustmentHandler{adjRepo: adjRepo, variantRepo: variantRepo, invRepo: invRepo}
}

// List GET /api/v1/inventory/adjustments
func (h *AdjustmentHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)
	adjs, total, err := h.adjRepo.List(r.Context(), pageSize, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list adjustments")
		return
	}
	WritePaginated(w, adjs, total, page, pageSize)
}

// Create POST /api/v1/inventory/adjustments
func (h *AdjustmentHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		VariantID uuid.UUID `json:"variant_id"`
		Quantity  int       `json:"quantity"`
		Reason    string    `json:"reason"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	if body.Reason == "" {
		WriteError(w, http.StatusBadRequest, "reason is required for stock adjustments")
		return
	}

	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	performedBy, _ := uuid.Parse(userIDStr)

	adj, err := h.adjRepo.CreateAdjustment(
		r.Context(),
		h.variantRepo,
		h.invRepo,
		body.VariantID,
		body.Quantity,
		body.Reason,
		performedBy,
	)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteCreated(w, adj)
}
