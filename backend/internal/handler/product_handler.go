package handler

import (
	"fmt"
	"net/http"

	"github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/Peoplesshop/backend/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type ProductHandler struct {
	productSvc  *service.ProductService
	productRepo *repository.ProductRepository
	variantRepo *repository.VariantRepository
}

func NewProductHandler(
	productSvc *service.ProductService,
	productRepo *repository.ProductRepository,
	variantRepo *repository.VariantRepository,
) *ProductHandler {
	return &ProductHandler{productSvc: productSvc, productRepo: productRepo, variantRepo: variantRepo}
}

// List GET /api/v1/products
func (h *ProductHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	offset := Offset(page, pageSize)

	f := repository.ProductFilters{
		Search: QueryString(r, "search", ""),
		Brand:  QueryString(r, "brand", ""),
	}
	if catStr := r.URL.Query().Get("category_id"); catStr != "" {
		var catID int
		if _, err := parseIntParam(catStr, &catID); err == nil {
			f.CategoryID = &catID
		}
	}
	if activeStr := r.URL.Query().Get("is_active"); activeStr == "true" {
		t := true
		f.IsActive = &t
	} else if activeStr == "false" {
		f := false
		_ = f
	}

	products, total, err := h.productRepo.List(r.Context(), pageSize, offset, f)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list products")
		return
	}
	WritePaginated(w, products, total, page, pageSize)
}

// Get GET /api/v1/products/{id}
func (h *ProductHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid product id")
		return
	}
	p, err := h.productRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "product not found")
		return
	}
	WriteSuccess(w, p)
}

// Create POST /api/v1/products
func (h *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreateProductRequest
	if !DecodeJSON(w, r, &req) {
		return
	}
	userIDStr, _ := r.Context().Value(middleware.ContextKeyUserID).(string)
	createdBy, _ := uuid.Parse(userIDStr)
	p, err := h.productSvc.CreateProduct(r.Context(), req, createdBy)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteCreated(w, p)
}

// Update PUT /api/v1/products/{id}
func (h *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	p, err := h.productRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "product not found")
		return
	}

	var req service.CreateProductRequest
	if !DecodeJSON(w, r, &req) {
		return
	}

	p.Name = req.Name
	p.Description = &req.Description
	p.CategoryID = req.CategoryID
	p.Brand = &req.Brand
	p.SupplierID = req.SupplierID
	if req.ImageURL != "" {
		p.ImageURL = &req.ImageURL
	}

	if err := h.productRepo.Update(r.Context(), p); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to update product")
		return
	}
	WriteSuccess(w, p)
}

// Archive DELETE /api/v1/products/{id}
func (h *ProductHandler) Archive(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid product id")
		return
	}
	if err := h.productRepo.SoftDelete(r.Context(), id); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to archive product")
		return
	}
	WriteSuccess(w, map[string]string{"message": "product archived"})
}

// AddVariant POST /api/v1/products/{id}/variants
func (h *ProductHandler) AddVariant(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid product id")
		return
	}

	var req service.CreateVariantRequest
	if !DecodeJSON(w, r, &req) {
		return
	}

	v, err := h.productSvc.AddVariant(r.Context(), productID, req)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteCreated(w, v)
}

// UpdateVariant PUT /api/v1/variants/{id}
func (h *ProductHandler) UpdateVariant(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid variant id")
		return
	}

	var req service.UpdateVariantRequest
	if !DecodeJSON(w, r, &req) {
		return
	}

	v, err := h.productSvc.UpdateVariant(r.Context(), id, req)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteSuccess(w, v)
}

// GetVariant GET /api/v1/variants/{id}
func (h *ProductHandler) GetVariant(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid variant id")
		return
	}
	v, err := h.variantRepo.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "variant not found")
		return
	}
	WriteSuccess(w, v)
}

// DeleteVariant DELETE /api/v1/variants/{id}
func (h *ProductHandler) DeleteVariant(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid variant id")
		return
	}
	if err := h.variantRepo.SoftDelete(r.Context(), id); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to delete variant")
		return
	}
	WriteSuccess(w, map[string]string{"message": "variant removed"})
}

func parseIntParam(s string, dest *int) (bool, error) {
	var n int
	if _, err := fmt.Sscan(s, &n); err != nil { //nolint:staticcheck
		return false, err
	}
	*dest = n
	return true, nil
}
