package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/model"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CustomerHandler struct {
	customerRepo *repository.CustomerRepository
	saleRepo     *repository.SaleRepository
}

func NewCustomerHandler(cr *repository.CustomerRepository, sr *repository.SaleRepository) *CustomerHandler {
	return &CustomerHandler{customerRepo: cr, saleRepo: sr}
}

func (h *CustomerHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)
	customers, total, err := h.customerRepo.List(r.Context(), pageSize, offset, QueryString(r, "search", ""))
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list customers")
		return
	}
	WritePaginated(w, customers, total, page, pageSize)
}

func (h *CustomerHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	c, err := h.customerRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "customer not found")
		return
	}
	count, total, _ := h.customerRepo.PurchaseHistory(r.Context(), id)
	WriteSuccess(w, map[string]interface{}{
		"customer":        c,
		"purchase_count":  count,
		"total_spent_kobo": total,
	})
}

func (h *CustomerHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FullName string `json:"full_name"`
		Phone    string `json:"phone"`
		Email    string `json:"email"`
		Address  string `json:"address"`
		Notes    string `json:"notes"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	if body.FullName == "" {
		WriteError(w, http.StatusBadRequest, "full_name is required")
		return
	}

	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	createdBy, _ := uuid.Parse(userIDStr)

	c := &model.Customer{ID: uuid.New(), FullName: body.FullName}
	if body.Phone != ""   { c.Phone = &body.Phone }
	if body.Email != ""   { c.Email = &body.Email }
	if body.Address != "" { c.Address = &body.Address }
	if body.Notes != ""   { c.Notes = &body.Notes }

	if err := h.customerRepo.Create(r.Context(), c, createdBy); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to create customer")
		return
	}
	WriteCreated(w, c)
}

func (h *CustomerHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	c, err := h.customerRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "customer not found")
		return
	}
	var body struct {
		FullName string `json:"full_name"`
		Phone    string `json:"phone"`
		Email    string `json:"email"`
		Address  string `json:"address"`
		Notes    string `json:"notes"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	c.FullName = body.FullName
	if body.Phone != ""   { c.Phone = &body.Phone }
	if body.Email != ""   { c.Email = &body.Email }
	if body.Address != "" { c.Address = &body.Address }
	if body.Notes != ""   { c.Notes = &body.Notes }

	if err := h.customerRepo.Update(r.Context(), c); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to update customer")
		return
	}
	WriteSuccess(w, c)
}
