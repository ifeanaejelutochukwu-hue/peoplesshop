// Package middleware provides HTTP middleware for the Peoplesshop API.
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/Peoplesshop/backend/internal/auth"
	"github.com/Peoplesshop/backend/internal/httputil"
)

type contextKey string

const (
	ContextKeyUserID   contextKey = "user_id"
	ContextKeyUsername contextKey = "username"
	ContextKeyRole     contextKey = "role"
)

// Authenticate validates the Bearer JWT in the Authorization header.
func Authenticate(jwtSvc *auth.JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
				httputil.WriteError(w, http.StatusUnauthorized, "invalid authorization header format")
				return
			}

			claims, err := jwtSvc.ValidateAccessToken(parts[1])
			if err != nil {
				if err == auth.ErrTokenExpired {
					httputil.WriteError(w, http.StatusUnauthorized, "token has expired")
					return
				}
				httputil.WriteError(w, http.StatusUnauthorized, "invalid token")
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextKeyUsername, claims.Username)
			ctx = context.WithValue(ctx, ContextKeyRole, claims.RoleName)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequirePermission checks that the authenticated user has the specified permission.
func RequirePermission(permissionName string, checker PermissionChecker) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := r.Context().Value(ContextKeyUserID).(string)
			if !ok || userID == "" {
				httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			has, err := checker.HasPermission(r.Context(), userID, permissionName)
			if err != nil {
				httputil.WriteError(w, http.StatusInternalServerError, "permission check failed")
				return
			}
			if !has {
				httputil.WriteError(w, http.StatusForbidden, "insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole restricts access to users with the specified role name.
func RequireRole(roleName string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value(ContextKeyRole).(string)
			if !ok || role != roleName {
				httputil.WriteError(w, http.StatusForbidden, "insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// PermissionChecker is implemented by the user repository.
type PermissionChecker interface {
	HasPermission(ctx context.Context, userID, permission string) (bool, error)
}
