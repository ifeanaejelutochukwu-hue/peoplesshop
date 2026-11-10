package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/Peoplesshop/backend/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type SaleHandler struct {
	saleSvc  *service.SaleService
	saleRepo *repository.SaleRepository
}

func NewSaleHandler(svc *service.SaleService, repo *repository.SaleRepository) *SaleHandler {
	return &SaleHandler{saleSvc: svc, saleRepo: repo}
}

func (h *SaleHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)

	ctx := r.Context()
	role, _ := ctx.Value(middleware.ContextKeyRole).(string)
	userIDStr, _ := ctx.Value(middleware.ContextKeyUserID).(string)

	f := repository.SaleFilters{
		Search:        QueryString(r, "search", ""),
		PaymentStatus: QueryString(r, "payment_status", ""),
	}
	// Attendants only see their own sales
	if role == "attendant" {
		uid, _ := uuid.Parse(userIDStr)
		f.ServedBy = &uid
	}

	sales, err := h.saleRepo.List(ctx, pageSize, offset, f)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list sales")
		return
	}
	total, _ := h.saleRepo.Count(ctx, f)
	WritePaginated(w, sales, total, page, pageSize)
}

func (h *SaleHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid sale id")
		return
	}
	sale, err := h.saleRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "sale not found")
		return
	}
	WriteSuccess(w, sale)
}

func (h *SaleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreateSaleRequest
	if !DecodeJSON(w, r, &req) {
		return
	}

	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	servedBy, _ := uuid.Parse(userIDStr)

	sale, err := h.saleSvc.CreateSale(r.Context(), req, servedBy)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteCreated(w, sale)
}

func (h *SaleHandler) Reverse(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid sale id")
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}

	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	performedBy, _ := uuid.Parse(userIDStr)

	if err := h.saleSvc.ReverseSale(r.Context(), id, body.Reason, performedBy); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteSuccess(w, map[string]string{"message": "sale reversed"})
}
