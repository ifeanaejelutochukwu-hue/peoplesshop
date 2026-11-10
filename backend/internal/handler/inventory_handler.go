package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/repository"
)

type InventoryHandler struct {
	invRepo *repository.InventoryRepository
}

func NewInventoryHandler(invRepo *repository.InventoryRepository) *InventoryHandler {
	return &InventoryHandler{invRepo: invRepo}
}

// GetOverview GET /api/v1/inventory
func (h *InventoryHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)

	search := QueryString(r, "search", "")
	stockStatus := QueryString(r, "stock_status", "")

	variants, total, err := h.invRepo.GetInventoryOverview(r.Context(), pageSize, offset, search, stockStatus)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load inventory")
		return
	}
	WritePaginated(w, variants, total, page, pageSize)
}

// ListMovements GET /api/v1/inventory/movements
func (h *InventoryHandler) ListMovements(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)

	f := repository.MovementFilters{
		MovementType: QueryString(r, "type", ""),
	}

	movements, err := h.invRepo.ListMovements(r.Context(), pageSize, offset, f)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list movements")
		return
	}
	total, _ := h.invRepo.CountMovements(r.Context(), f)
	WritePaginated(w, movements, total, page, pageSize)
}
