package repository

import (
	"context"
	"fmt"

	"github.com/Peoplesshop/backend/internal/model"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SettingsRepository struct {
	db *pgxpool.Pool
}

func NewSettingsRepository(db *pgxpool.Pool) *SettingsRepository {
	return &SettingsRepository{db: db}
}

// Get returns the single business settings row.
func (r *SettingsRepository) Get(ctx context.Context) (*model.BusinessSettings, error) {
	s := &model.BusinessSettings{}
	query := `
		SELECT id, shop_name, logo_url, phone, email, address,
		       currency_code, currency_symbol, timezone,
		       default_low_stock_threshold,
		       sku_prefix, sku_auto_generate,
		       allow_discount, max_discount_percent,
		       tax_enabled, tax_percent, tax_name,
		       receipt_footer_text, return_window_days
		FROM business_settings
		LIMIT 1
	`
	err := r.db.QueryRow(ctx, query).Scan(
		&s.ID, &s.ShopName, &s.LogoURL, &s.Phone, &s.Email, &s.Address,
		&s.CurrencyCode, &s.CurrencySymbol, &s.Timezone,
		&s.DefaultLowStockThreshold,
		&s.SKUPrefix, &s.SKUAutoGenerate,
		&s.AllowDiscount, &s.MaxDiscountPercent,
		&s.TaxEnabled, &s.TaxPercent, &s.TaxName,
		&s.ReceiptFooterText, &s.ReturnWindowDays,
	)
	if err != nil {
		return nil, fmt.Errorf("get business settings: %w", err)
	}
	return s, nil
}

// Update saves the business settings.
func (r *SettingsRepository) Update(ctx context.Context, s *model.BusinessSettings) error {
	query := `
		UPDATE business_settings SET
		    shop_name = $1, logo_url = $2, phone = $3, email = $4, address = $5,
		    currency_code = $6, currency_symbol = $7, timezone = $8,
		    default_low_stock_threshold = $9,
		    sku_prefix = $10, sku_auto_generate = $11,
		    allow_discount = $12, max_discount_percent = $13,
		    tax_enabled = $14, tax_percent = $15, tax_name = $16,
		    receipt_footer_text = $17, return_window_days = $18,
		    updated_at = NOW()
		WHERE id = $19
	`
	_, err := r.db.Exec(ctx, query,
		s.ShopName, s.LogoURL, s.Phone, s.Email, s.Address,
		s.CurrencyCode, s.CurrencySymbol, s.Timezone,
		s.DefaultLowStockThreshold,
		s.SKUPrefix, s.SKUAutoGenerate,
		s.AllowDiscount, s.MaxDiscountPercent,
		s.TaxEnabled, s.TaxPercent, s.TaxName,
		s.ReceiptFooterText, s.ReturnWindowDays,
		s.ID,
	)
	return err
}
