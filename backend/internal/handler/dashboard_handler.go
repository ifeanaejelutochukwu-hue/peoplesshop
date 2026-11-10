package handler

import (
	"net/http"

	"github.com/Peoplesshop/backend/internal/repository"
)

type DashboardHandler struct {
	dashRepo *repository.DashboardRepository
	saleRepo *repository.SaleRepository
	invRepo  *repository.InventoryRepository
}

func NewDashboardHandler(
	dashRepo *repository.DashboardRepository,
	saleRepo *repository.SaleRepository,
	invRepo *repository.InventoryRepository,
) *DashboardHandler {
	return &DashboardHandler{dashRepo: dashRepo, saleRepo: saleRepo, invRepo: invRepo}
}

// Get GET /api/v1/dashboard
func (h *DashboardHandler) Get(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	summary, err := h.dashRepo.GetSummary(ctx)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load dashboard summary")
		return
	}

	salesTrend, err := h.dashRepo.GetSalesTrend(ctx, 30)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load sales trend")
		return
	}

	catSales, err := h.dashRepo.GetCategorySales(ctx, 30)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load category sales")
		return
	}

	lowStock, err := h.dashRepo.GetLowStockItems(ctx, 10)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load low stock items")
		return
	}

	recentSales, err := h.saleRepo.List(ctx, 8, 0, repository.SaleFilters{})
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load recent sales")
		return
	}

	recentMovements, err := h.invRepo.ListMovements(ctx, 8, 0, repository.MovementFilters{})
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to load recent movements")
		return
	}

	WriteSuccess(w, map[string]interface{}{
		"summary":          summary,
		"sales_trend":      salesTrend,
		"category_sales":   catSales,
		"recent_sales":     recentSales,
		"recent_movements": recentMovements,
		"low_stock_items":  lowStock,
	})
}
