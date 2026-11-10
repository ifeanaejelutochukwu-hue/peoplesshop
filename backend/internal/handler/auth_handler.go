package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/middleware"
	"github.com/Peoplesshop/backend/internal/service"
	"github.com/google/uuid"
)

// AuthHandler handles /api/v1/auth/* routes.
type AuthHandler struct {
	authSvc *service.AuthService
}

func NewAuthHandler(authSvc *service.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

// Login POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req service.LoginRequest
	if !DecodeJSON(w, r, &req) {
		return
	}

	resp, err := h.authSvc.Login(r.Context(), req)
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			WriteError(w, http.StatusUnauthorized, "invalid username or password")
		case service.ErrAccountDisabled:
			WriteError(w, http.StatusForbidden, "your account has been disabled")
		default:
			WriteError(w, http.StatusInternalServerError, "login failed")
		}
		return
	}

	WriteSuccess(w, resp)
}

// Logout POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(middleware.ContextKeyUserID).(string)
	if !ok {
		WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := h.authSvc.Logout(r.Context(), userID); err != nil {
		WriteError(w, http.StatusInternalServerError, "logout failed")
		return
	}

	WriteSuccess(w, map[string]string{"message": "logged out successfully"})
}

// Me GET /api/v1/auth/me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(middleware.ContextKeyUserID).(string)
	if !ok {
		WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	resp, err := h.authSvc.Me(r.Context(), userID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to get user info")
		return
	}

	WriteSuccess(w, resp)
}

// Refresh POST /api/v1/auth/refresh
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	if body.RefreshToken == "" {
		WriteError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	tokens, err := h.authSvc.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}

	WriteSuccess(w, tokens)
}
