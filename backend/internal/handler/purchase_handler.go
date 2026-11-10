package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/Peoplesshop/backend/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PurchaseHandler struct {
	purchaseSvc  *service.PurchaseService
	purchaseRepo *repository.PurchaseRepository
}

func NewPurchaseHandler(svc *service.PurchaseService, repo *repository.PurchaseRepository) *PurchaseHandler {
	return &PurchaseHandler{purchaseSvc: svc, purchaseRepo: repo}
}

func (h *PurchaseHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)
	purchases, total, err := h.purchaseRepo.List(r.Context(), pageSize, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list purchases")
		return
	}
	WritePaginated(w, purchases, total, page, pageSize)
}

func (h *PurchaseHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid purchase id")
		return
	}
	p, err := h.purchaseRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "purchase not found")
		return
	}
	WriteSuccess(w, p)
}

func (h *PurchaseHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreatePurchaseRequest
	if !DecodeJSON(w, r, &req) {
		return
	}

	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	createdBy, _ := uuid.Parse(userIDStr)

	p, err := h.purchaseSvc.Create(r.Context(), req, createdBy)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteCreated(w, p)
}

func (h *PurchaseHandler) ReceiveStock(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid purchase id")
		return
	}

	var body struct {
		Items []service.ReceiveItemRequest `json:"items"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}

	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	performedBy, _ := uuid.Parse(userIDStr)

	if err := h.purchaseSvc.ReceiveStock(r.Context(), id, body.Items, performedBy); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	p, _ := h.purchaseRepo.GetByID(r.Context(), id)
	WriteSuccess(w, p)
}
