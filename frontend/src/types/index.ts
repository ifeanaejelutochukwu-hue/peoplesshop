// ============================================================
// Peoplesshop — Shared TypeScript Types
// All monetary values from the API are in KOBO (integer).
// Use formatMoney() to display as Naira.
// ============================================================

export interface Role {
  id: number;
  name: "owner" | "manager" | "attendant";
  description: string;
}

export interface User {
  id: string;
  full_name: string;
  username: string;
  email?: string;
  role: Role;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  permissions: string[];
}

export interface BusinessSettings {
  id: number;
  shop_name: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency_code: string;
  currency_symbol: string;
  timezone: string;
  default_low_stock_threshold: number;
  sku_prefix: string;
  sku_auto_generate: boolean;
  allow_discount: boolean;
  max_discount_percent: number;
  tax_enabled: boolean;
  tax_percent: number;
  tax_name: string;
  receipt_footer_text?: string;
  return_window_days: number;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  product?: Product;
  sku: string;
  barcode?: string;
  size?: string;
  colour?: string;
  selling_price_kobo: number;
  cost_price_kobo: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  stock_status?: "in_stock" | "low_stock" | "out_of_stock";
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category_id?: number;
  category?: Category;
  brand?: string;
  image_url?: string;
  supplier_id?: string;
  supplier?: Supplier;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  variants?: ProductVariant[];
  total_stock_units?: number;
}

export interface Customer {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_walk_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount_kobo: number;
  payment_method: string;
  reference?: string;
  notes?: string;
  recorded_by: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  variant_id: string;
  variant?: ProductVariant;
  quantity: number;
  unit_price_kobo: number;
  unit_cost_kobo: number;
  discount_kobo: number;
  total_price_kobo: number;
  created_at: string;
}

export interface Sale {
  id: string;
  reference: string;
  customer_id: string;
  customer?: Customer;
  served_by: string;
  served_by_user?: User;
  subtotal_kobo: number;
  discount_kobo: number;
  tax_kobo: number;
  total_kobo: number;
  amount_paid_kobo: number;
  payment_status: "unpaid" | "partial" | "paid";
  status: "completed" | "reversed" | "cancelled";
  notes?: string;
  sale_channel: string;
  created_at: string;
  updated_at: string;
  items?: SaleItem[];
  payments?: Payment[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  variant_id: string;
  variant?: ProductVariant;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost_kobo: number;
  total_cost_kobo: number;
}

export interface PurchasePayment {
  id: string;
  purchase_id: string;
  amount_kobo: number;
  payment_method: string;
  payment_date: string;
  reference?: string;
  notes?: string;
}

export interface Purchase {
  id: string;
  reference: string;
  supplier_id: string;
  supplier?: Supplier;
  purchase_date: string;
  expected_delivery?: string;
  notes?: string;
  subtotal_kobo: number;
  discount_kobo: number;
  extra_costs_kobo: number;
  total_kobo: number;
  amount_paid_kobo: number;
  payment_status: "unpaid" | "partial" | "paid";
  receiving_status: "pending" | "partial" | "received" | "cancelled";
  created_by: string;
  created_by_user?: User;
  created_at: string;
  updated_at: string;
  items?: PurchaseItem[];
  payments?: PurchasePayment[];
}

export interface InventoryMovement {
  id: string;
  variant_id: string;
  variant?: ProductVariant;
  movement_type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reason?: string;
  reference_type?: string;
  reference_id?: string;
  performed_by: string;
  performed_by_user?: User;
  created_at: string;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  variant_id: string;
  variant?: ProductVariant;
  quantity: number;
  condition: "resalable" | "damaged" | "defective";
  unit_price_kobo: number;
  restock: boolean;
}

export interface Return {
  id: string;
  reference: string;
  sale_id: string;
  sale?: Sale;
  customer_id?: string;
  return_type: "refund" | "exchange";
  reason?: string;
  refund_amount_kobo: number;
  refund_method?: string;
  status: "pending" | "approved" | "rejected";
  processed_by: string;
  created_at: string;
  updated_at: string;
  items?: ReturnItem[];
}

export interface ExpenseCategory {
  id: number;
  name: string;
}

export interface Expense {
  id: string;
  expense_category_id: number;
  expense_category?: ExpenseCategory;
  description: string;
  amount_kobo: number;
  expense_date: string;
  payment_method?: string;
  receipt_url?: string;
  notes?: string;
  recorded_by: string;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  reference: string;
  variant_id: string;
  variant?: ProductVariant;
  quantity: number;
  reason: string;
  approved_by?: string;
  created_by: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: string;
  user?: User;
  action: string;
  resource_type?: string;
  resource_id?: string;
  old_values?: unknown;
  new_values?: unknown;
  ip_address?: string;
  created_at: string;
}

// ---- API Response Wrappers ----

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    fields?: Record<string, string>;
  };
  meta?: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ---- POS Cart ----

export interface CartItem {
  variant: ProductVariant;
  product: Product;
  quantity: number;
  unit_price_kobo: number;
  discount_kobo: number;
}

export interface CartPayment {
  method: string;
  amount_kobo: number;
  reference?: string;
}

// ---- Dashboard ----

export interface DashboardSummary {
  total_products: number;
  total_stock_units: number;
  total_inventory_value_kobo: number;
  todays_sales_kobo: number;
  monthly_sales_kobo: number;
  gross_profit_kobo: number;
  low_stock_count: number;
  out_of_stock_count: number;
}
