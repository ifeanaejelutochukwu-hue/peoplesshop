package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/model"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type SupplierHandler struct {
	supplierRepo *repository.SupplierRepository
}

func NewSupplierHandler(supplierRepo *repository.SupplierRepository) *SupplierHandler {
	return &SupplierHandler{supplierRepo: supplierRepo}
}

func (h *SupplierHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)
	search := QueryString(r, "search", "")

	suppliers, total, err := h.supplierRepo.List(r.Context(), pageSize, offset, search)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list suppliers")
		return
	}
	WritePaginated(w, suppliers, total, page, pageSize)
}

func (h *SupplierHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid supplier id")
		return
	}
	s, err := h.supplierRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "supplier not found")
		return
	}
	WriteSuccess(w, s)
}

func (h *SupplierHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name          string `json:"name"`
		ContactPerson string `json:"contact_person"`
		Phone         string `json:"phone"`
		Email         string `json:"email"`
		Address       string `json:"address"`
		Description   string `json:"description"`
		Notes         string `json:"notes"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "supplier name is required")
		return
	}

	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	createdBy, _ := uuid.Parse(userIDStr)

	s := &model.Supplier{
		ID:       uuid.New(),
		Name:     body.Name,
		IsActive: true,
	}
	if body.ContactPerson != "" { s.ContactPerson = &body.ContactPerson }
	if body.Phone != ""         { s.Phone = &body.Phone }
	if body.Email != ""         { s.Email = &body.Email }
	if body.Address != ""       { s.Address = &body.Address }
	if body.Description != ""   { s.Description = &body.Description }
	if body.Notes != ""         { s.Notes = &body.Notes }

	if err := h.supplierRepo.Create(r.Context(), s, createdBy); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to create supplier")
		return
	}
	WriteCreated(w, s)
}

func (h *SupplierHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid supplier id")
		return
	}

	s, err := h.supplierRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "supplier not found")
		return
	}

	var body struct {
		Name          string `json:"name"`
		ContactPerson string `json:"contact_person"`
		Phone         string `json:"phone"`
		Email         string `json:"email"`
		Address       string `json:"address"`
		Description   string `json:"description"`
		Notes         string `json:"notes"`
		IsActive      bool   `json:"is_active"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}

	s.Name = body.Name
	s.IsActive = body.IsActive
	if body.ContactPerson != "" { s.ContactPerson = &body.ContactPerson }
	if body.Phone != ""         { s.Phone = &body.Phone }
	if body.Email != ""         { s.Email = &body.Email }
	if body.Address != ""       { s.Address = &body.Address }
	if body.Description != ""   { s.Description = &body.Description }
	if body.Notes != ""         { s.Notes = &body.Notes }

	if err := h.supplierRepo.Update(r.Context(), s); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to update supplier")
		return
	}
	WriteSuccess(w, s)
}
