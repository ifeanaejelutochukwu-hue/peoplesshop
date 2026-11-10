// Package httputil provides shared HTTP response helpers.
// It has no internal dependencies to avoid import cycles.
package httputil

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
)

// APIResponse is the standard envelope for all API responses.
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

// APIError carries structured error information.
type APIError struct {
	Code    string            `json:"code,omitempty"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

// WriteJSON serialises v to JSON and writes it with the given status code.
func WriteJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

// WriteSuccess writes a 200 OK JSON response.
func WriteSuccess(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusOK, APIResponse{Success: true, Data: data})
}

// WriteCreated writes a 201 Created JSON response.
func WriteCreated(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusCreated, APIResponse{Success: true, Data: data})
}

// WriteError writes an error response.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, APIResponse{
		Success: false,
		Error:   &APIError{Message: message},
	})
}

// WriteValidationError writes a 422 Unprocessable Entity with field errors.
func WriteValidationError(w http.ResponseWriter, fields map[string]string) {
	WriteJSON(w, http.StatusUnprocessableEntity, APIResponse{
		Success: false,
		Error: &APIError{
			Message: "validation failed",
			Fields:  fields,
		},
	})
}

// WritePaginated writes a paginated response.
func WritePaginated(w http.ResponseWriter, data interface{}, total int64, page, pageSize int) {
	totalPages := int(total) / pageSize
	if pageSize > 0 && int(total)%pageSize != 0 {
		totalPages++
	}
	WriteJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    data,
		Meta: map[string]interface{}{
			"total":       total,
			"page":        page,
			"page_size":   pageSize,
			"total_pages": totalPages,
		},
	})
}

// DecodeJSON decodes the request body into v and handles errors.
func DecodeJSON(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB limit
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return false
	}
	return true
}

// PaginationParams extracts page and page_size query parameters.
func PaginationParams(r *http.Request) (page, pageSize int) {
	page = 1
	pageSize = 20

	if p := r.URL.Query().Get("page"); p != "" {
		var v int
		if _, err := fmt.Sscan(p, &v); err == nil && v > 0 {
			page = v
		}
	}
	if ps := r.URL.Query().Get("page_size"); ps != "" {
		var v int
		if _, err := fmt.Sscan(ps, &v); err == nil && v > 0 && v <= 100 {
			pageSize = v
		}
	}
	return
}

// Offset calculates the SQL OFFSET from page and pageSize.
func Offset(page, pageSize int) int {
	return (page - 1) * pageSize
}

// QueryString returns a query parameter value or a default.
func QueryString(r *http.Request, key, defaultVal string) string {
	if v := r.URL.Query().Get(key); v != "" {
		return v
	}
	return defaultVal
}
