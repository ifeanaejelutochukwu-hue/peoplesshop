package handler

import (
	"net/http"
	"strconv"

	"github.com/Peoplesshop/backend/internal/repository"
	"github.com/go-chi/chi/v5"
)

type CategoryHandler struct {
	catRepo *repository.CategoryRepository
}

func NewCategoryHandler(catRepo *repository.CategoryRepository) *CategoryHandler {
	return &CategoryHandler{catRepo: catRepo}
}

func (h *CategoryHandler) List(w http.ResponseWriter, r *http.Request) {
	cats, err := h.catRepo.List(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list categories")
		return
	}
	WriteSuccess(w, cats)
}

func (h *CategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "name is required")
		return
	}
	cat, err := h.catRepo.Create(r.Context(), body.Name, body.Description)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to create category")
		return
	}
	WriteCreated(w, cat)
}

func (h *CategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid category id")
		return
	}
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	cat, err := h.catRepo.Update(r.Context(), id, body.Name, body.Description)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to update category")
		return
	}
	WriteSuccess(w, cat)
}

func (h *CategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid category id")
		return
	}
	if err := h.catRepo.Delete(r.Context(), id); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to delete category")
		return
	}
	WriteSuccess(w, map[string]string{"message": "category deleted"})
}
