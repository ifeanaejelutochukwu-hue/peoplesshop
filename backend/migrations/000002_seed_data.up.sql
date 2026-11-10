-- =============================================================
-- Migration 000002: Seed Data
-- Development seed data — NOT for production
-- =============================================================

-- ---- Roles ----
INSERT INTO roles (name, description) VALUES
    ('owner',     'Full system access — business owner'),
    ('manager',   'Day-to-day operations management'),
    ('attendant', 'POS and sales only')
ON CONFLICT (name) DO NOTHING;

-- ---- Permissions ----
INSERT INTO permissions (name, description) VALUES
    -- Dashboard
    ('dashboard:view',           'View dashboard'),
    -- Products
    ('products:view',            'View products'),
    ('products:create',          'Create products'),
    ('products:edit',            'Edit products'),
    ('products:delete',          'Archive/delete products'),
    -- Categories
    ('categories:manage',        'Create and edit categories'),
    -- Variants
    ('variants:manage',          'Manage product variants'),
    -- Inventory
    ('inventory:view',           'View inventory'),
    ('inventory:adjust',         'Perform stock adjustments'),
    -- Purchases
    ('purchases:view',           'View purchases'),
    ('purchases:create',         'Create purchase orders'),
    ('purchases:receive',        'Receive stock from purchases'),
    -- Suppliers
    ('suppliers:view',           'View suppliers'),
    ('suppliers:manage',         'Create and edit suppliers'),
    -- POS
    ('pos:access',               'Access Point of Sale'),
    -- Sales
    ('sales:view',               'View all sales'),
    ('sales:view_own',           'View own sales only'),
    ('sales:reverse',            'Reverse/cancel a sale'),
    -- Customers
    ('customers:view',           'View customers'),
    ('customers:manage',         'Create and edit customers'),
    -- Returns
    ('returns:view',             'View returns'),
    ('returns:process',          'Process returns and exchanges'),
    ('returns:approve',          'Approve returns'),
    -- Expenses
    ('expenses:view',            'View expenses'),
    ('expenses:manage',          'Record and edit expenses'),
    -- Staff
    ('staff:view',               'View staff list'),
    ('staff:manage',             'Create and manage staff accounts'),
    -- Reports
    ('reports:sales',            'View sales reports'),
    ('reports:inventory',        'View inventory reports'),
    ('reports:financial',        'View financial reports'),
    -- Settings
    ('settings:view',            'View settings'),
    ('settings:manage',          'Modify system settings'),
    -- Audit Logs
    ('audit:view',               'View audit logs')
ON CONFLICT (name) DO NOTHING;

-- ---- Role → Permissions: Owner (all) ----
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- ---- Role → Permissions: Manager ----
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager'
  AND p.name IN (
    'dashboard:view',
    'products:view', 'products:create', 'products:edit',
    'categories:manage', 'variants:manage',
    'inventory:view', 'inventory:adjust',
    'purchases:view', 'purchases:create', 'purchases:receive',
    'suppliers:view', 'suppliers:manage',
    'pos:access',
    'sales:view', 'sales:reverse',
    'customers:view', 'customers:manage',
    'returns:view', 'returns:process', 'returns:approve',
    'expenses:view', 'expenses:manage',
    'staff:view',
    'reports:sales', 'reports:inventory',
    'settings:view'
)
ON CONFLICT DO NOTHING;

-- ---- Role → Permissions: Attendant ----
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'attendant'
  AND p.name IN (
    'dashboard:view',
    'products:view',
    'inventory:view',
    'pos:access',
    'sales:view_own',
    'customers:view', 'customers:manage',
    'returns:view'
)
ON CONFLICT DO NOTHING;

-- ---- Business Settings ----
INSERT INTO business_settings (
    shop_name, phone, email, address,
    currency_code, currency_symbol, timezone,
    default_low_stock_threshold,
    sku_prefix, sku_auto_generate,
    allow_discount, max_discount_percent,
    tax_enabled, tax_percent, tax_name,
    receipt_footer_text, return_window_days
) VALUES (
    'Peoplesshop',
    '+234 000 000 0000',
    'info@peoplesshop.ng',
    'Lagos, Nigeria',
    'NGN', '₦', 'Africa/Lagos',
    5,
    'PS', TRUE,
    TRUE, 30.00,
    FALSE, 0.00, 'VAT',
    'Thank you for shopping at Peoplesshop!',
    7
) ON CONFLICT DO NOTHING;

-- ---- Expense Categories ----
INSERT INTO expense_categories (name) VALUES
    ('Rent'),
    ('Electricity'),
    ('Internet'),
    ('Transportation'),
    ('Staff Salaries'),
    ('Packaging'),
    ('Repairs & Maintenance'),
    ('Advertising'),
    ('Miscellaneous')
ON CONFLICT (name) DO NOTHING;

-- ---- Default Categories ----
INSERT INTO categories (name, description) VALUES
    ('Shirts',       'T-shirts, dress shirts and tops'),
    ('Trousers',     'Formal and casual trousers'),
    ('Jeans',        'Denim jeans and shorts'),
    ('Dresses',      'Ladies dresses and gowns'),
    ('Jackets',      'Jackets and coats'),
    ('Hoodies',      'Hoodies and sweatshirts'),
    ('Shoes',        'All types of shoes'),
    ('Sneakers',     'Trainers and sneakers'),
    ('Accessories',  'Belts, caps, bags and accessories')
ON CONFLICT (name) DO NOTHING;

-- ---- Default Owner Account ----
-- Password: Admin@2026! (bcrypt hash — change on first login)
-- Hash generated with bcrypt cost 12
INSERT INTO users (
    id, full_name, username, email,
    password_hash, role_id, is_active, created_at, updated_at
)
SELECT
    '00000000-0000-0000-0000-000000000002',
    'Shop Owner',
    'admin',
    'admin@peoplesshop.ng',
    '$2a$12$Vs.XOKAllNkoRVHPDzsIhei073kXC8MH1uRbZXTmdSiy7.ELK2eP2',
    r.id,
    TRUE,
    NOW(),
    NOW()
FROM roles r WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;
