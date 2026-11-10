// Package handler provides HTTP route handlers.
// Response helpers are re-exported from httputil for convenience within this package.
package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/httputil"
)

// Re-export httputil helpers so handlers can use them without extra imports.

func WriteJSON(w http.ResponseWriter, status int, v interface{}) {
	httputil.WriteJSON(w, status, v)
}

func WriteSuccess(w http.ResponseWriter, data interface{}) {
	httputil.WriteSuccess(w, data)
}

func WriteCreated(w http.ResponseWriter, data interface{}) {
	httputil.WriteCreated(w, data)
}

func WriteError(w http.ResponseWriter, status int, message string) {
	httputil.WriteError(w, status, message)
}

func WriteValidationError(w http.ResponseWriter, fields map[string]string) {
	httputil.WriteValidationError(w, fields)
}

func WritePaginated(w http.ResponseWriter, data interface{}, total int64, page, pageSize int) {
	httputil.WritePaginated(w, data, total, page, pageSize)
}

func DecodeJSON(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	return httputil.DecodeJSON(w, r, v)
}

func PaginationParams(r *http.Request) (page, pageSize int) {
	return httputil.PaginationParams(r)
}

func Offset(page, pageSize int) int {
	return httputil.Offset(page, pageSize)
}

func QueryString(r *http.Request, key, defaultVal string) string {
	return httputil.QueryString(r, key, defaultVal)
}
