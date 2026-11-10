package handler

import (
	"net/http"
	"time"

	"github.com/Peoplesshop/backend/internal/repository"
)

type ReportHandler struct {
	reportRepo *repository.ReportRepository
}

func NewReportHandler(reportRepo *repository.ReportRepository) *ReportHandler {
	return &ReportHandler{reportRepo: reportRepo}
}

// parseDateRange reads from/to query params; defaults to current month.
func parseDateRange(r *http.Request) (from, to time.Time) {
	now := time.Now()
	from = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	to = from.AddDate(0, 1, 0)

	if s := r.URL.Query().Get("from"); s != "" {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			from = t
		}
	}
	if s := r.URL.Query().Get("to"); s != "" {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			to = t.AddDate(0, 0, 1) // inclusive end
		}
	}
	return
}

// GetSalesReport GET /api/v1/reports/sales
func (h *ReportHandler) GetSalesReport(w http.ResponseWriter, r *http.Request) {
	from, to := parseDateRange(r)
	rows, err := h.reportRepo.GetSalesReport(r.Context(), from, to)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to generate sales report")
		return
	}
	WriteSuccess(w, map[string]interface{}{
		"from": from.Format("2006-01-02"),
		"to":   to.AddDate(0, 0, -1).Format("2006-01-02"),
		"rows": rows,
	})
}

// GetProfitReport GET /api/v1/reports/profit
func (h *ReportHandler) GetProfitReport(w http.ResponseWriter, r *http.Request) {
	from, to := parseDateRange(r)
	summary, err := h.reportRepo.GetProfitSummary(r.Context(), from, to)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to generate profit report")
		return
	}
	WriteSuccess(w, map[string]interface{}{
		"from":    from.Format("2006-01-02"),
		"to":      to.AddDate(0, 0, -1).Format("2006-01-02"),
		"summary": summary,
	})
}

// GetInventoryReport GET /api/v1/reports/inventory
func (h *ReportHandler) GetInventoryReport(w http.ResponseWriter, r *http.Request) {
	result, err := h.reportRepo.GetInventoryReport(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to generate inventory report")
		return
	}
	WriteSuccess(w, result)
}

// GetProductPerformance GET /api/v1/reports/products
func (h *ReportHandler) GetProductPerformance(w http.ResponseWriter, r *http.Request) {
	from, to := parseDateRange(r)
	rows, err := h.reportRepo.GetProductPerformance(r.Context(), from, to, 50)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to generate product report")
		return
	}
	WriteSuccess(w, map[string]interface{}{
		"from": from.Format("2006-01-02"),
		"to":   to.AddDate(0, 0, -1).Format("2006-01-02"),
		"rows": rows,
	})
}
