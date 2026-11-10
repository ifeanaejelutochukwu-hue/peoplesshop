package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ReportRepository struct {
	db *pgxpool.Pool
}

func NewReportRepository(db *pgxpool.Pool) *ReportRepository {
	return &ReportRepository{db: db}
}

type SaleReportRow struct {
	Date          string `json:"date"`
	TotalSales    int64  `json:"total_sales_kobo"`
	TotalCOGS     int64  `json:"total_cogs_kobo"`
	GrossProfit   int64  `json:"gross_profit_kobo"`
	TxCount       int    `json:"transaction_count"`
}

type ProfitSummary struct {
	TotalRevenueKobo   int64 `json:"total_revenue_kobo"`
	TotalCOGSKobo      int64 `json:"total_cogs_kobo"`
	GrossProfitKobo    int64 `json:"gross_profit_kobo"`
	TotalExpensesKobo  int64 `json:"total_expenses_kobo"`
	NetProfitKobo      int64 `json:"net_profit_kobo"`
}

type ProductPerformanceRow struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	SKU         string `json:"sku"`
	Size        string `json:"size"`
	Colour      string `json:"colour"`
	QtySold     int    `json:"qty_sold"`
	RevenueKobo int64  `json:"revenue_kobo"`
	ProfitKobo  int64  `json:"profit_kobo"`
}

// GetSalesReport returns daily sales totals between dates.
func (r *ReportRepository) GetSalesReport(ctx context.Context, from, to time.Time) ([]SaleReportRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		    TO_CHAR(DATE_TRUNC('day', s.created_at), 'YYYY-MM-DD') AS date,
		    COALESCE(SUM(s.total_kobo), 0),
		    COALESCE(SUM(si.total_cost_kobo), 0),
		    COALESCE(SUM(s.total_kobo) - SUM(si.total_cost_kobo), 0),
		    COUNT(DISTINCT s.id)
		FROM sales s
		LEFT JOIN (
		    SELECT sale_id, SUM(unit_cost_kobo * quantity) AS total_cost_kobo
		    FROM sale_items GROUP BY sale_id
		) si ON si.sale_id = s.id
		WHERE s.status = 'completed'
		  AND s.created_at >= $1 AND s.created_at < $2
		GROUP BY DATE_TRUNC('day', s.created_at)
		ORDER BY DATE_TRUNC('day', s.created_at)
	`, from, to)
	if err != nil {
		return nil, fmt.Errorf("sales report: %w", err)
	}
	defer rows.Close()

	var result []SaleReportRow
	for rows.Next() {
		var row SaleReportRow
		if err := rows.Scan(&row.Date, &row.TotalSales, &row.TotalCOGS, &row.GrossProfit, &row.TxCount); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// GetProfitSummary returns revenue, COGS, expenses and net profit.
func (r *ReportRepository) GetProfitSummary(ctx context.Context, from, to time.Time) (*ProfitSummary, error) {
	s := &ProfitSummary{}

	err := r.db.QueryRow(ctx, `
		SELECT
		    COALESCE(SUM(s.total_kobo), 0),
		    COALESCE(SUM(si_cost.total_cost), 0),
		    COALESCE(SUM(s.total_kobo) - SUM(si_cost.total_cost), 0)
		FROM sales s
		LEFT JOIN (
		    SELECT sale_id, SUM(unit_cost_kobo * quantity) AS total_cost
		    FROM sale_items GROUP BY sale_id
		) si_cost ON si_cost.sale_id = s.id
		WHERE s.status = 'completed'
		  AND s.created_at >= $1 AND s.created_at < $2
	`, from, to).Scan(&s.TotalRevenueKobo, &s.TotalCOGSKobo, &s.GrossProfitKobo)
	if err != nil {
		return nil, fmt.Errorf("profit revenue: %w", err)
	}

	if err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_kobo), 0) FROM expenses
		WHERE deleted_at IS NULL AND expense_date >= $1 AND expense_date < $2
	`, from.Format("2006-01-02"), to.Format("2006-01-02")).Scan(&s.TotalExpensesKobo); err != nil {
		return nil, fmt.Errorf("profit expenses: %w", err)
	}

	s.NetProfitKobo = s.GrossProfitKobo - s.TotalExpensesKobo
	return s, nil
}

// GetProductPerformance returns best-selling variants.
func (r *ReportRepository) GetProductPerformance(ctx context.Context, from, to time.Time, limit int) ([]ProductPerformanceRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		    p.id::text,
		    p.name,
		    pv.sku,
		    COALESCE(pv.size, ''),
		    COALESCE(pv.colour, ''),
		    COALESCE(SUM(si.quantity), 0) AS qty_sold,
		    COALESCE(SUM(si.total_price_kobo), 0) AS revenue,
		    COALESCE(SUM(si.total_price_kobo - si.unit_cost_kobo * si.quantity), 0) AS profit
		FROM sale_items si
		JOIN product_variants pv ON pv.id = si.variant_id
		JOIN products p ON p.id = pv.product_id
		JOIN sales s ON s.id = si.sale_id
		WHERE s.status = 'completed'
		  AND s.created_at >= $1 AND s.created_at < $2
		GROUP BY p.id, p.name, pv.sku, pv.size, pv.colour
		ORDER BY qty_sold DESC
		LIMIT $3
	`, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("product performance: %w", err)
	}
	defer rows.Close()

	var result []ProductPerformanceRow
	for rows.Next() {
		var row ProductPerformanceRow
		if err := rows.Scan(&row.ProductID, &row.ProductName, &row.SKU,
			&row.Size, &row.Colour, &row.QtySold, &row.RevenueKobo, &row.ProfitKobo); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// GetInventoryReport returns current stock value summary.
func (r *ReportRepository) GetInventoryReport(ctx context.Context) (map[string]interface{}, error) {
	var totalUnits int64
	var totalCostKobo, totalValueKobo int64

	if err := r.db.QueryRow(ctx, `
		SELECT
		    COALESCE(SUM(stock_quantity), 0),
		    COALESCE(SUM(stock_quantity * cost_price_kobo), 0),
		    COALESCE(SUM(stock_quantity * selling_price_kobo), 0)
		FROM product_variants WHERE deleted_at IS NULL AND is_active = TRUE
	`).Scan(&totalUnits, &totalCostKobo, &totalValueKobo); err != nil {
		return nil, err
	}

	var lowStockCount, outOfStockCount int64
	if err := r.db.QueryRow(ctx, `
		SELECT
		    COUNT(*) FILTER (WHERE stock_quantity > 0 AND stock_quantity <= low_stock_threshold),
		    COUNT(*) FILTER (WHERE stock_quantity = 0)
		FROM product_variants WHERE deleted_at IS NULL AND is_active = TRUE
	`).Scan(&lowStockCount, &outOfStockCount); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_units":          totalUnits,
		"total_cost_kobo":      totalCostKobo,
		"total_value_kobo":     totalValueKobo,
		"low_stock_count":      lowStockCount,
		"out_of_stock_count":   outOfStockCount,
	}, nil
}
