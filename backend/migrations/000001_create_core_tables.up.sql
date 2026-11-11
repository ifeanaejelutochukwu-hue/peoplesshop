-- =============================================================
-- Migration 000001: Core Tables
-- Peoplesshop Retail Management System
-- =============================================================

-- Extensions (required for GIN indexes and UUID generation)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---- Users & Auth ----

CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,       -- owner, manager, attendant
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,      -- e.g. products:create
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     VARCHAR(150) NOT NULL,
    username      VARCHAR(80)  NOT NULL UNIQUE,
    email         VARCHAR(150) UNIQUE,
    password_hash TEXT         NOT NULL,
    role_id       INT          NOT NULL REFERENCES roles(id),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_by    UUID         REFERENCES users(id),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email)    WHERE deleted_at IS NULL;

-- Refresh tokens (stored as hashed values)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ---- Business Settings ----

CREATE TABLE IF NOT EXISTS business_settings (
    id                          SERIAL PRIMARY KEY,
    shop_name                   VARCHAR(200) NOT NULL DEFAULT 'Peoplesshop',
    logo_url                    TEXT,
    phone                       VARCHAR(50),
    email                       VARCHAR(150),
    address                     TEXT,
    currency_code               CHAR(3)      NOT NULL DEFAULT 'NGN',
    currency_symbol             VARCHAR(5)   NOT NULL DEFAULT '₦',
    timezone                    VARCHAR(60)  NOT NULL DEFAULT 'Africa/Lagos',
    -- Inventory
    default_low_stock_threshold INT          NOT NULL DEFAULT 5,
    sku_prefix                  VARCHAR(20)  NOT NULL DEFAULT 'SKU',
    sku_auto_generate           BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Sales
    allow_discount              BOOLEAN      NOT NULL DEFAULT TRUE,
    max_discount_percent        NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    tax_enabled                 BOOLEAN      NOT NULL DEFAULT FALSE,
    tax_percent                 NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    tax_name                    VARCHAR(50)  NOT NULL DEFAULT 'VAT',
    -- Receipt
    receipt_footer_text         TEXT,
    -- Returns
    return_window_days          INT          NOT NULL DEFAULT 7,
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---- Expense Categories ----

CREATE TABLE IF NOT EXISTS expense_categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ---- Suppliers ----

CREATE TABLE IF NOT EXISTS suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    contact_person  VARCHAR(150),
    phone           VARCHAR(50),
    email           VARCHAR(150),
    address         TEXT,
    description     TEXT,
    notes           TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers USING gin(name gin_trgm_ops) WHERE deleted_at IS NULL;

-- ---- Categories ----

CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- ---- Products ----

CREATE TABLE IF NOT EXISTS products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(250) NOT NULL,
    description TEXT,
    category_id INT          REFERENCES categories(id),
    brand       VARCHAR(100),
    image_url   TEXT,
    supplier_id UUID         REFERENCES suppliers(id),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by  UUID         REFERENCES users(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops) WHERE deleted_at IS NULL;

-- ---- Product Variants ----

CREATE TABLE IF NOT EXISTS product_variants (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id           UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku                  VARCHAR(80)  NOT NULL UNIQUE,
    barcode              VARCHAR(80),
    size                 VARCHAR(50),    -- e.g. S, M, L, XL, 32, 10, One Size
    colour               VARCHAR(80),    -- e.g. Black, White, Navy Blue
    selling_price_kobo   BIGINT       NOT NULL DEFAULT 0 CHECK (selling_price_kobo >= 0),
    cost_price_kobo      BIGINT       NOT NULL DEFAULT 0 CHECK (cost_price_kobo >= 0),
    stock_quantity       INT          NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold  INT          NOT NULL DEFAULT 5,
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_variants_product  ON product_variants(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_variants_sku      ON product_variants(sku)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_variants_barcode  ON product_variants(barcode)    WHERE deleted_at IS NULL AND barcode IS NOT NULL;

-- ---- Customers ----

CREATE TABLE IF NOT EXISTS customers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name      VARCHAR(150) NOT NULL,
    phone          VARCHAR(50)  UNIQUE,
    email          VARCHAR(150) UNIQUE,
    address        TEXT,
    notes          TEXT,
    is_walk_in     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by     UUID         REFERENCES users(id),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin(full_name gin_trgm_ops) WHERE deleted_at IS NULL;

-- Insert the system walk-in customer
INSERT INTO customers (id, full_name, phone, is_walk_in, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Walk-in Customer',
    NULL,
    TRUE,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- ---- Purchases ----

CREATE TABLE IF NOT EXISTS purchases (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference          VARCHAR(40)  NOT NULL UNIQUE,
    supplier_id        UUID         NOT NULL REFERENCES suppliers(id),
    purchase_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery  DATE,
    notes              TEXT,
    -- Totals (kobo)
    subtotal_kobo      BIGINT       NOT NULL DEFAULT 0,
    discount_kobo      BIGINT       NOT NULL DEFAULT 0,
    extra_costs_kobo   BIGINT       NOT NULL DEFAULT 0,
    total_kobo         BIGINT       NOT NULL DEFAULT 0,
    amount_paid_kobo   BIGINT       NOT NULL DEFAULT 0,
    -- Status
    payment_status     VARCHAR(20)  NOT NULL DEFAULT 'unpaid'   CHECK (payment_status IN ('unpaid','partial','paid')),
    receiving_status   VARCHAR(20)  NOT NULL DEFAULT 'pending'  CHECK (receiving_status IN ('pending','partial','received','cancelled')),
    created_by         UUID         NOT NULL REFERENCES users(id),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date     ON purchases(purchase_date DESC);

CREATE TABLE IF NOT EXISTS purchase_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id          UUID    NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    variant_id           UUID    NOT NULL REFERENCES product_variants(id),
    quantity_ordered     INT     NOT NULL CHECK (quantity_ordered > 0),
    quantity_received    INT     NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost_kobo       BIGINT  NOT NULL CHECK (unit_cost_kobo >= 0),
    total_cost_kobo      BIGINT  NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS purchase_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id     UUID         NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    amount_kobo     BIGINT       NOT NULL CHECK (amount_kobo > 0),
    payment_method  VARCHAR(50)  NOT NULL,
    payment_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
    reference       VARCHAR(100),
    notes           TEXT,
    recorded_by     UUID         NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase ON purchase_payments(purchase_id);

-- ---- Sales ----

CREATE TABLE IF NOT EXISTS sales (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference        VARCHAR(40)   NOT NULL UNIQUE,
    customer_id      UUID          NOT NULL REFERENCES customers(id)
                                   DEFAULT '00000000-0000-0000-0000-000000000001',
    served_by        UUID          NOT NULL REFERENCES users(id),
    -- Totals (kobo)
    subtotal_kobo    BIGINT        NOT NULL DEFAULT 0,
    discount_kobo    BIGINT        NOT NULL DEFAULT 0,
    tax_kobo         BIGINT        NOT NULL DEFAULT 0,
    total_kobo       BIGINT        NOT NULL DEFAULT 0,
    amount_paid_kobo BIGINT        NOT NULL DEFAULT 0,
    -- Status
    payment_status   VARCHAR(20)   NOT NULL DEFAULT 'unpaid'
                     CHECK (payment_status IN ('unpaid','partial','paid')),
    status           VARCHAR(20)   NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('completed','reversed','cancelled')),
    notes            TEXT,
    -- Future: branch support
    branch_id        INT,
    sale_channel     VARCHAR(20)   NOT NULL DEFAULT 'physical',
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_served_by   ON sales(served_by);
CREATE INDEX IF NOT EXISTS idx_sales_customer    ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date        ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_reference   ON sales(reference);

CREATE TABLE IF NOT EXISTS sale_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id          UUID   NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    variant_id       UUID   NOT NULL REFERENCES product_variants(id),
    quantity         INT    NOT NULL CHECK (quantity > 0),
    -- Prices are LOCKED at time of sale — never update these
    unit_price_kobo  BIGINT NOT NULL,
    unit_cost_kobo   BIGINT NOT NULL,
    discount_kobo    BIGINT NOT NULL DEFAULT 0,
    total_price_kobo BIGINT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);

CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID         NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    amount_kobo     BIGINT       NOT NULL CHECK (amount_kobo > 0),
    payment_method  VARCHAR(50)  NOT NULL,   -- cash, bank_transfer, pos_card, other
    reference       VARCHAR(100),
    notes           TEXT,
    recorded_by     UUID         NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

-- ---- Inventory Movements ----

CREATE TABLE IF NOT EXISTS inventory_movements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id       UUID         NOT NULL REFERENCES product_variants(id),
    movement_type    VARCHAR(30)  NOT NULL
                     CHECK (movement_type IN (
                         'purchase_received',
                         'sale',
                         'return_resalable',
                         'return_damaged',
                         'adjustment_add',
                         'adjustment_deduct',
                         'opening_stock',
                         'transfer_in',
                         'transfer_out'
                     )),
    quantity         INT          NOT NULL,    -- positive = increase, negative = decrease
    quantity_before  INT          NOT NULL,
    quantity_after   INT          NOT NULL,
    reason           TEXT,
    reference_type   VARCHAR(30),              -- sale, purchase, return, adjustment
    reference_id     UUID,
    performed_by     UUID         NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_variant   ON inventory_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type      ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_movements_ref       ON inventory_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_date      ON inventory_movements(created_at DESC);

-- ---- Stock Adjustments ----

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference   VARCHAR(40)  NOT NULL UNIQUE,
    variant_id  UUID         NOT NULL REFERENCES product_variants(id),
    quantity    INT          NOT NULL,         -- positive or negative
    reason      TEXT         NOT NULL,
    approved_by UUID         REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_by  UUID         NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---- Returns ----

CREATE TABLE IF NOT EXISTS returns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference           VARCHAR(40)  NOT NULL UNIQUE,
    sale_id             UUID         NOT NULL REFERENCES sales(id),
    customer_id         UUID         REFERENCES customers(id),
    return_type         VARCHAR(20)  NOT NULL DEFAULT 'refund'
                        CHECK (return_type IN ('refund','exchange')),
    reason              TEXT,
    refund_amount_kobo  BIGINT       NOT NULL DEFAULT 0,
    refund_method       VARCHAR(50),
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected')),
    processed_by        UUID         NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id          UUID         NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    sale_item_id       UUID         NOT NULL REFERENCES sale_items(id),
    variant_id         UUID         NOT NULL REFERENCES product_variants(id),
    quantity           INT          NOT NULL CHECK (quantity > 0),
    condition          VARCHAR(20)  NOT NULL DEFAULT 'resalable'
                       CHECK (condition IN ('resalable','damaged','defective')),
    unit_price_kobo    BIGINT       NOT NULL,
    restock            BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---- Expenses ----

CREATE TABLE IF NOT EXISTS expenses (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_category_id  INT          NOT NULL REFERENCES expense_categories(id),
    description          TEXT         NOT NULL,
    amount_kobo          BIGINT       NOT NULL CHECK (amount_kobo > 0),
    expense_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
    payment_method       VARCHAR(50),
    receipt_url          TEXT,
    notes                TEXT,
    recorded_by          UUID         NOT NULL REFERENCES users(id),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(expense_category_id) WHERE deleted_at IS NULL;

-- ---- Audit Logs ----

CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID         REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,   -- e.g. product.created, sale.reversed
    resource_type   VARCHAR(50),
    resource_id     TEXT,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date     ON audit_logs(created_at DESC);
