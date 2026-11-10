package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardRepository struct {
	db *pgxpool.Pool
}

func NewDashboardRepository(db *pgxpool.Pool) *DashboardRepository {
	return &DashboardRepository{db: db}
}

type DashboardSummary struct {
	TotalProducts            int   `json:"total_products"`
	TotalStockUnits          int   `json:"total_stock_units"`
	TotalInventoryValueKobo  int64 `json:"total_inventory_value_kobo"`
	TodaysSalesKobo          int64 `json:"todays_sales_kobo"`
	MonthlySalesKobo         int64 `json:"monthly_sales_kobo"`
	GrossProfitKobo          int64 `json:"gross_profit_kobo"`
	LowStockCount            int   `json:"low_stock_count"`
	OutOfStockCount          int   `json:"out_of_stock_count"`
}

type SalesTrend struct {
	Date  string `json:"date"`
	Sales int64  `json:"sales"`
}

type CategorySales struct {
	Category string `json:"category"`
	Revenue  int64  `json:"revenue"`
}

type LowStockItem struct {
	VariantID         string `json:"variant_id"`
	SKU               string `json:"sku"`
	ProductName       string `json:"product_name"`
	Size              string `json:"size"`
	Colour            string `json:"colour"`
	StockQuantity     int    `json:"stock_quantity"`
	LowStockThreshold int    `json:"low_stock_threshold"`
}

// GetSummary returns the main dashboard KPI cards.
func (r *DashboardRepository) GetSummary(ctx context.Context) (*DashboardSummary, error) {
	s := &DashboardSummary{}

	// Total active products
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM products WHERE deleted_at IS NULL AND is_active = TRUE`,
	).Scan(&s.TotalProducts); err != nil {
		return nil, fmt.Errorf("count products: %w", err)
	}

	// Total stock units and inventory value
	if err := r.db.QueryRow(ctx, `
		SELECT
		    COALESCE(SUM(pv.stock_quantity), 0),
		    COALESCE(SUM(pv.stock_quantity * pv.cost_price_kobo), 0)
		FROM product_variants pv
		WHERE pv.deleted_at IS NULL AND pv.is_active = TRUE
	`).Scan(&s.TotalStockUnits, &s.TotalInventoryValueKobo); err != nil {
		return nil, fmt.Errorf("inventory totals: %w", err)
	}

	// Today's sales
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_kobo), 0)
		FROM sales
		WHERE status = 'completed' AND created_at >= $1
	`, todayStart).Scan(&s.TodaysSalesKobo); err != nil {
		return nil, fmt.Errorf("today sales: %w", err)
	}

	// Monthly sales
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	if err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_kobo), 0)
		FROM sales
		WHERE status = 'completed' AND created_at >= $1
	`, monthStart).Scan(&s.MonthlySalesKobo); err != nil {
		return nil, fmt.Errorf("monthly sales: %w", err)
	}

	// Gross profit (revenue - COGS, from locked sale_item prices)
	if err := r.db.QueryRow(ctx, `
		SELECT COALESCE(
		    SUM(si.total_price_kobo - (si.unit_cost_kobo * si.quantity)),
		    0
		)
		FROM sale_items si
		JOIN sales s ON s.id = si.sale_id
		WHERE s.status = 'completed'
	`).Scan(&s.GrossProfitKobo); err != nil {
		return nil, fmt.Errorf("gross profit: %w", err)
	}

	// Low stock count
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM product_variants pv
		WHERE pv.deleted_at IS NULL
		  AND pv.is_active = TRUE
		  AND pv.stock_quantity > 0
		  AND pv.stock_quantity <= pv.low_stock_threshold
	`).Scan(&s.LowStockCount); err != nil {
		return nil, fmt.Errorf("low stock count: %w", err)
	}

	// Out of stock count
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM product_variants pv
		WHERE pv.deleted_at IS NULL AND pv.is_active = TRUE AND pv.stock_quantity = 0
	`).Scan(&s.OutOfStockCount); err != nil {
		return nil, fmt.Errorf("out of stock count: %w", err)
	}

	return s, nil
}

// GetSalesTrend returns daily sales totals for the past N days.
func (r *DashboardRepository) GetSalesTrend(ctx context.Context, days int) ([]SalesTrend, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		    TO_CHAR(DATE_TRUNC('day', created_at), 'DD Mon') AS date,
		    COALESCE(SUM(total_kobo), 0) AS sales
		FROM sales
		WHERE status = 'completed'
		  AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
		GROUP BY DATE_TRUNC('day', created_at)
		ORDER BY DATE_TRUNC('day', created_at)
	`, days)
	if err != nil {
		return nil, fmt.Errorf("sales trend: %w", err)
	}
	defer rows.Close()

	var result []SalesTrend
	for rows.Next() {
		var t SalesTrend
		if err := rows.Scan(&t.Date, &t.Sales); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

// GetCategorySales returns revenue per category.
func (r *DashboardRepository) GetCategorySales(ctx context.Context, days int) ([]CategorySales, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		    COALESCE(c.name, 'Uncategorised') AS category,
		    COALESCE(SUM(si.total_price_kobo), 0) AS revenue
		FROM sale_items si
		JOIN sales s ON s.id = si.sale_id
		JOIN product_variants pv ON pv.id = si.variant_id
		JOIN products p ON p.id = pv.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE s.status = 'completed'
		  AND s.created_at >= NOW() - ($1::int * INTERVAL '1 day')
		GROUP BY COALESCE(c.name, 'Uncategorised')
		ORDER BY revenue DESC
		LIMIT 8
	`, days)
	if err != nil {
		return nil, fmt.Errorf("category sales: %w", err)
	}
	defer rows.Close()

	var result []CategorySales
	for rows.Next() {
		var cs CategorySales
		if err := rows.Scan(&cs.Category, &cs.Revenue); err != nil {
			return nil, err
		}
		result = append(result, cs)
	}
	return result, rows.Err()
}

// GetLowStockItems returns variants at or below their threshold.
func (r *DashboardRepository) GetLowStockItems(ctx context.Context, limit int) ([]LowStockItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
		    pv.id::text,
		    pv.sku,
		    p.name,
		    COALESCE(pv.size, ''),
		    COALESCE(pv.colour, ''),
		    pv.stock_quantity,
		    pv.low_stock_threshold
		FROM product_variants pv
		JOIN products p ON p.id = pv.product_id
		WHERE pv.deleted_at IS NULL
		  AND pv.is_active = TRUE
		  AND pv.stock_quantity <= pv.low_stock_threshold
		ORDER BY pv.stock_quantity ASC, p.name
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("low stock items: %w", err)
	}
	defer rows.Close()

	var items []LowStockItem
	for rows.Next() {
		var it LowStockItem
		if err := rows.Scan(&it.VariantID, &it.SKU, &it.ProductName,
			&it.Size, &it.Colour, &it.StockQuantity, &it.LowStockThreshold); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}
