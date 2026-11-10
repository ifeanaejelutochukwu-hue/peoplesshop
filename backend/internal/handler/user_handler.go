package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// UserHandler handles /api/v1/staff/* routes.
type UserHandler struct {
	userSvc *service.UserService
}

func NewUserHandler(userSvc *service.UserService) *UserHandler {
	return &UserHandler{userSvc: userSvc}
}

// List GET /api/v1/staff
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := PaginationParams(r)
	users, total, err := h.userSvc.List(r.Context(), page, pageSize)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list staff")
		return
	}
	WritePaginated(w, users, total, page, pageSize)
}

// Create POST /api/v1/staff
func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreateUserRequest
	if !DecodeJSON(w, r, &req) {
		return
	}

	user, err := h.userSvc.Create(r.Context(), req)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteCreated(w, user)
}

// SetActive PATCH /api/v1/staff/{id}/status
func (h *UserHandler) SetActive(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var body struct {
		IsActive bool `json:"is_active"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}

	if err := h.userSvc.SetActive(r.Context(), id, body.IsActive); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	WriteSuccess(w, map[string]string{"message": "status updated"})
}

// ResetPassword POST /api/v1/staff/{id}/reset-password
func (h *UserHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var body struct {
		NewPassword string `json:"new_password"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	if len(body.NewPassword) < 8 {
		WriteError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	if err := h.userSvc.ResetPassword(r.Context(), id, body.NewPassword); err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to reset password")
		return
	}

	WriteSuccess(w, map[string]string{"message": "password reset successfully"})
}

// ListRoles GET /api/v1/roles
func (h *UserHandler) ListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.userSvc.ListRoles(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list roles")
		return
	}
	WriteSuccess(w, roles)
}
