// Package model defines the core domain types for Peoplesshop.
// All monetary values are stored as int64 in kobo (minor currency units).
// 1 Naira = 100 Kobo. Display layer divides by 100.
package model

import (
	"time"

	"github.com/google/uuid"
)

// ---- Auth / Users ----

type Role struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Permission struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type User struct {
	ID           uuid.UUID  `json:"id"`
	FullName     string     `json:"full_name"`
	Username     string     `json:"username"`
	Email        *string    `json:"email,omitempty"`
	Role         Role       `json:"role"`
	IsActive     bool       `json:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	// PasswordHash is never serialised to JSON
	PasswordHash string     `json:"-"`
	RoleID       int        `json:"-"`
}

// ---- Business Settings ----

type BusinessSettings struct {
	ID                       int     `json:"id"`
	ShopName                 string  `json:"shop_name"`
	LogoURL                  *string `json:"logo_url,omitempty"`
	Phone                    *string `json:"phone,omitempty"`
	Email                    *string `json:"email,omitempty"`
	Address                  *string `json:"address,omitempty"`
	CurrencyCode             string  `json:"currency_code"`
	CurrencySymbol           string  `json:"currency_symbol"`
	Timezone                 string  `json:"timezone"`
	DefaultLowStockThreshold int     `json:"default_low_stock_threshold"`
	SKUPrefix                string  `json:"sku_prefix"`
	SKUAutoGenerate          bool    `json:"sku_auto_generate"`
	AllowDiscount            bool    `json:"allow_discount"`
	MaxDiscountPercent       float64 `json:"max_discount_percent"`
	TaxEnabled               bool    `json:"tax_enabled"`
	TaxPercent               float64 `json:"tax_percent"`
	TaxName                  string  `json:"tax_name"`
	ReceiptFooterText        *string `json:"receipt_footer_text,omitempty"`
	ReturnWindowDays         int     `json:"return_window_days"`
}

// ---- Category ----

type Category struct {
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ---- Supplier ----

type Supplier struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	ContactPerson *string    `json:"contact_person,omitempty"`
	Phone         *string    `json:"phone,omitempty"`
	Email         *string    `json:"email,omitempty"`
	Address       *string    `json:"address,omitempty"`
	Description   *string    `json:"description,omitempty"`
	Notes         *string    `json:"notes,omitempty"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// ---- Product ----

type Product struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	CategoryID  *int       `json:"category_id,omitempty"`
	Category    *Category  `json:"category,omitempty"`
	Brand       *string    `json:"brand,omitempty"`
	ImageURL    *string    `json:"image_url,omitempty"`
	SupplierID  *uuid.UUID `json:"supplier_id,omitempty"`
	Supplier    *Supplier  `json:"supplier,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	// Computed fields
	Variants        []ProductVariant `json:"variants,omitempty"`
	TotalStockUnits int              `json:"total_stock_units,omitempty"`
}

// ---- Product Variant ----

type ProductVariant struct {
	ID                 uuid.UUID  `json:"id"`
	ProductID          uuid.UUID  `json:"product_id"`
	Product            *Product   `json:"product,omitempty"`
	SKU                string     `json:"sku"`
	Barcode            *string    `json:"barcode,omitempty"`
	Size               *string    `json:"size,omitempty"`
	Colour             *string    `json:"colour,omitempty"`
	SellingPriceKobo   int64      `json:"selling_price_kobo"`
	CostPriceKobo      int64      `json:"cost_price_kobo"`
	StockQuantity      int        `json:"stock_quantity"`
	LowStockThreshold  int        `json:"low_stock_threshold"`
	IsActive           bool       `json:"is_active"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	// Computed
	StockStatus string `json:"stock_status,omitempty"` // in_stock, low_stock, out_of_stock
}

func (v *ProductVariant) ComputeStockStatus() string {
	if v.StockQuantity <= 0 {
		return "out_of_stock"
	}
	if v.StockQuantity <= v.LowStockThreshold {
		return "low_stock"
	}
	return "in_stock"
}

// ---- Customer ----

type Customer struct {
	ID           uuid.UUID  `json:"id"`
	FullName     string     `json:"full_name"`
	Phone        *string    `json:"phone,omitempty"`
	Email        *string    `json:"email,omitempty"`
	Address      *string    `json:"address,omitempty"`
	Notes        *string    `json:"notes,omitempty"`
	IsWalkIn     bool       `json:"is_walk_in"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// ---- Inventory Movement ----

type InventoryMovement struct {
	ID             uuid.UUID  `json:"id"`
	VariantID      uuid.UUID  `json:"variant_id"`
	Variant        *ProductVariant `json:"variant,omitempty"`
	MovementType   string     `json:"movement_type"`
	Quantity       int        `json:"quantity"`
	QuantityBefore int        `json:"quantity_before"`
	QuantityAfter  int        `json:"quantity_after"`
	Reason         *string    `json:"reason,omitempty"`
	ReferenceType  *string    `json:"reference_type,omitempty"`
	ReferenceID    *uuid.UUID `json:"reference_id,omitempty"`
	PerformedBy    uuid.UUID  `json:"performed_by"`
	PerformedByUser *User     `json:"performed_by_user,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// ---- Sale ----

type Sale struct {
	ID              uuid.UUID  `json:"id"`
	Reference       string     `json:"reference"`
	CustomerID      uuid.UUID  `json:"customer_id"`
	Customer        *Customer  `json:"customer,omitempty"`
	ServedBy        uuid.UUID  `json:"served_by"`
	ServedByUser    *User      `json:"served_by_user,omitempty"`
	SubtotalKobo    int64      `json:"subtotal_kobo"`
	DiscountKobo    int64      `json:"discount_kobo"`
	TaxKobo         int64      `json:"tax_kobo"`
	TotalKobo       int64      `json:"total_kobo"`
	AmountPaidKobo  int64      `json:"amount_paid_kobo"`
	PaymentStatus   string     `json:"payment_status"`
	Status          string     `json:"status"`
	Notes           *string    `json:"notes,omitempty"`
	SaleChannel     string     `json:"sale_channel"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	// Relations
	Items    []SaleItem `json:"items,omitempty"`
	Payments []Payment  `json:"payments,omitempty"`
}

type SaleItem struct {
	ID              uuid.UUID       `json:"id"`
	SaleID          uuid.UUID       `json:"sale_id"`
	VariantID       uuid.UUID       `json:"variant_id"`
	Variant         *ProductVariant `json:"variant,omitempty"`
	Quantity        int             `json:"quantity"`
	UnitPriceKobo   int64           `json:"unit_price_kobo"`
	UnitCostKobo    int64           `json:"unit_cost_kobo"`
	DiscountKobo    int64           `json:"discount_kobo"`
	TotalPriceKobo  int64           `json:"total_price_kobo"`
	CreatedAt       time.Time       `json:"created_at"`
}

type Payment struct {
	ID            uuid.UUID  `json:"id"`
	SaleID        uuid.UUID  `json:"sale_id"`
	AmountKobo    int64      `json:"amount_kobo"`
	PaymentMethod string     `json:"payment_method"`
	Reference     *string    `json:"reference,omitempty"`
	Notes         *string    `json:"notes,omitempty"`
	RecordedBy    uuid.UUID  `json:"recorded_by"`
	CreatedAt     time.Time  `json:"created_at"`
}

// ---- Purchase ----

type Purchase struct {
	ID               uuid.UUID  `json:"id"`
	Reference        string     `json:"reference"`
	SupplierID       uuid.UUID  `json:"supplier_id"`
	Supplier         *Supplier  `json:"supplier,omitempty"`
	PurchaseDate     time.Time  `json:"purchase_date"`
	ExpectedDelivery *time.Time `json:"expected_delivery,omitempty"`
	Notes            *string    `json:"notes,omitempty"`
	SubtotalKobo     int64      `json:"subtotal_kobo"`
	DiscountKobo     int64      `json:"discount_kobo"`
	ExtraCostsKobo   int64      `json:"extra_costs_kobo"`
	TotalKobo        int64      `json:"total_kobo"`
	AmountPaidKobo   int64      `json:"amount_paid_kobo"`
	PaymentStatus    string     `json:"payment_status"`
	ReceivingStatus  string     `json:"receiving_status"`
	CreatedBy        uuid.UUID  `json:"created_by"`
	CreatedByUser    *User      `json:"created_by_user,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	Items            []PurchaseItem    `json:"items,omitempty"`
	Payments         []PurchasePayment `json:"payments,omitempty"`
}

type PurchaseItem struct {
	ID               uuid.UUID       `json:"id"`
	PurchaseID       uuid.UUID       `json:"purchase_id"`
	VariantID        uuid.UUID       `json:"variant_id"`
	Variant          *ProductVariant `json:"variant,omitempty"`
	QuantityOrdered  int             `json:"quantity_ordered"`
	QuantityReceived int             `json:"quantity_received"`
	UnitCostKobo     int64           `json:"unit_cost_kobo"`
	TotalCostKobo    int64           `json:"total_cost_kobo"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

type PurchasePayment struct {
	ID            uuid.UUID  `json:"id"`
	PurchaseID    uuid.UUID  `json:"purchase_id"`
	AmountKobo    int64      `json:"amount_kobo"`
	PaymentMethod string     `json:"payment_method"`
	PaymentDate   time.Time  `json:"payment_date"`
	Reference     *string    `json:"reference,omitempty"`
	Notes         *string    `json:"notes,omitempty"`
	RecordedBy    uuid.UUID  `json:"recorded_by"`
	CreatedAt     time.Time  `json:"created_at"`
}

// ---- Return ----

type Return struct {
	ID               uuid.UUID    `json:"id"`
	Reference        string       `json:"reference"`
	SaleID           uuid.UUID    `json:"sale_id"`
	Sale             *Sale        `json:"sale,omitempty"`
	CustomerID       *uuid.UUID   `json:"customer_id,omitempty"`
	ReturnType       string       `json:"return_type"`
	Reason           *string      `json:"reason,omitempty"`
	RefundAmountKobo int64        `json:"refund_amount_kobo"`
	RefundMethod     *string      `json:"refund_method,omitempty"`
	Status           string       `json:"status"`
	ProcessedBy      uuid.UUID    `json:"processed_by"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
	Items            []ReturnItem `json:"items,omitempty"`
}

type ReturnItem struct {
	ID            uuid.UUID       `json:"id"`
	ReturnID      uuid.UUID       `json:"return_id"`
	SaleItemID    uuid.UUID       `json:"sale_item_id"`
	VariantID     uuid.UUID       `json:"variant_id"`
	Variant       *ProductVariant `json:"variant,omitempty"`
	Quantity      int             `json:"quantity"`
	Condition     string          `json:"condition"`
	UnitPriceKobo int64           `json:"unit_price_kobo"`
	Restock       bool            `json:"restock"`
	CreatedAt     time.Time       `json:"created_at"`
}

// ---- Expense ----

type Expense struct {
	ID                 uuid.UUID        `json:"id"`
	ExpenseCategoryID  int              `json:"expense_category_id"`
	ExpenseCategory    *ExpenseCategory `json:"expense_category,omitempty"`
	Description        string           `json:"description"`
	AmountKobo         int64            `json:"amount_kobo"`
	ExpenseDate        time.Time        `json:"expense_date"`
	PaymentMethod      *string          `json:"payment_method,omitempty"`
	ReceiptURL         *string          `json:"receipt_url,omitempty"`
	Notes              *string          `json:"notes,omitempty"`
	RecordedBy         uuid.UUID        `json:"recorded_by"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

type ExpenseCategory struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// ---- Stock Adjustment ----

type StockAdjustment struct {
	ID         uuid.UUID  `json:"id"`
	Reference  string     `json:"reference"`
	VariantID  uuid.UUID  `json:"variant_id"`
	Variant    *ProductVariant `json:"variant,omitempty"`
	Quantity   int        `json:"quantity"`
	Reason     string     `json:"reason"`
	ApprovedBy *uuid.UUID `json:"approved_by,omitempty"`
	ApprovedAt *time.Time `json:"approved_at,omitempty"`
	CreatedBy  uuid.UUID  `json:"created_by"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ---- Audit Log ----

type AuditLog struct {
	ID           int64          `json:"id"`
	UserID       *uuid.UUID     `json:"user_id,omitempty"`
	User         *User          `json:"user,omitempty"`
	Action       string         `json:"action"`
	ResourceType *string        `json:"resource_type,omitempty"`
	ResourceID   *string        `json:"resource_id,omitempty"`
	OldValues    interface{}    `json:"old_values,omitempty"`
	NewValues    interface{}    `json:"new_values,omitempty"`
	IPAddress    *string        `json:"ip_address,omitempty"`
	UserAgent    *string        `json:"user_agent,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
}

// ---- Pagination ----

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}
