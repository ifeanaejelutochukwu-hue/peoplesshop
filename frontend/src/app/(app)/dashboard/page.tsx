"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Package, Layers, TrendingUp, ShoppingBag,
  AlertTriangle, XCircle, DollarSign, BarChart2
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardSummary, Sale, InventoryMovement } from "@/types";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";

// ---- Types ----
interface SalesTrend { date: string; sales: number; }
interface CategorySales { category: string; revenue: number; }
interface DashboardData {
  summary: DashboardSummary;
  sales_trend: SalesTrend[];
  category_sales: CategorySales[];
  recent_sales: Sale[];
  recent_movements: InventoryMovement[];
  low_stock_items: Array<{
    variant_id: string; sku: string; product_name: string;
    size: string; colour: string; stock_quantity: number; low_stock_threshold: number;
  }>;
}

// ---- Stat Card ----
function StatCard({
  label, value, icon: Icon, sub, color = "purple"
}: {
  label: string; value: string; icon: React.ElementType;
  sub?: string; color?: "purple" | "orange" | "green" | "red" | "amber";
}) {
  const iconColors: Record<string, string> = {
    purple: "bg-brand-purple-light text-brand-purple",
    orange: "bg-brand-orange-light text-brand-orange",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-text-primary">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ---- Loading skeleton ----
function SkeletonCard() {
  return (
    <div className="stat-card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-7 bg-gray-200 rounded w-32" />
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardData>("/dashboard"),
    refetchInterval: 60_000, // refresh every minute
  });

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load dashboard data. Please refresh the page.
        </div>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Business overview for today"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Products"
              value={summary?.total_products?.toLocaleString() ?? "0"}
              icon={Package}
              color="purple"
            />
            <StatCard
              label="Stock Units"
              value={summary?.total_stock_units?.toLocaleString() ?? "0"}
              icon={Layers}
              color="orange"
            />
            <StatCard
              label="Inventory Value"
              value={formatMoney(summary?.total_inventory_value_kobo ?? 0)}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              label="Today's Sales"
              value={formatMoney(summary?.todays_sales_kobo ?? 0)}
              icon={ShoppingBag}
              color="purple"
            />
            <StatCard
              label="Monthly Sales"
              value={formatMoney(summary?.monthly_sales_kobo ?? 0)}
              icon={TrendingUp}
              color="orange"
            />
            <StatCard
              label="Gross Profit"
              value={formatMoney(summary?.gross_profit_kobo ?? 0)}
              icon={BarChart2}
              color="green"
            />
            <StatCard
              label="Low Stock"
              value={summary?.low_stock_count?.toString() ?? "0"}
              icon={AlertTriangle}
              sub="products need restocking"
              color="amber"
            />
            <StatCard
              label="Out of Stock"
              value={summary?.out_of_stock_count?.toString() ?? "0"}
              icon={XCircle}
              sub="variants unavailable"
              color="red"
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Sales Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {isLoading ? (
              <div className="h-full bg-gray-100 animate-pulse rounded" />
            ) : (data?.sales_trend?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data!.sales_trend}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AC7" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7C3AC7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E0E8" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    tickLine={false} axisLine={false}
                    tickFormatter={(v) => `₦${(v / 100000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatMoney(v), "Sales"]}
                    contentStyle={{ fontSize: 12, borderColor: "#E2E0E8" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#7C3AC7"
                    strokeWidth={2}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No sales data for the past 30 days" />
            )}
          </CardContent>
        </Card>

        {/* Sales by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {isLoading ? (
              <div className="h-full bg-gray-100 animate-pulse rounded" />
            ) : (data?.category_sales?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.category_sales} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E0E8" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#6B7280" }}
                    tickLine={false} axisLine={false}
                    tickFormatter={(v) => `₦${(v / 100000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    tickLine={false} axisLine={false}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatMoney(v), "Revenue"]}
                    contentStyle={{ fontSize: 12, borderColor: "#E2E0E8" }}
                  />
                  <Bar dataKey="revenue" fill="#F5821E" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No category data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
                ))}
              </div>
            ) : (data?.recent_sales?.length ?? 0) > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Time</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recent_sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-mono text-xs">{sale.reference}</td>
                      <td className="text-text-muted text-xs">{formatDateTime(sale.created_at)}</td>
                      <td className="text-right font-medium">{formatMoney(sale.total_kobo)}</td>
                      <td>
                        <PaymentBadge status={sale.payment_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-5"><EmptyState message="No transactions yet" /></div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
                ))}
              </div>
            ) : (data?.low_stock_items?.length ?? 0) > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Min</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.low_stock_items.map((item) => (
                    <tr key={item.variant_id}>
                      <td>
                        <div className="font-medium truncate max-w-[140px]">{item.product_name}</div>
                        <div className="text-xs text-text-muted">{[item.size, item.colour].filter(Boolean).join(" / ")}</div>
                      </td>
                      <td className="font-mono text-xs text-text-muted">{item.sku}</td>
                      <td className="text-right">
                        <span className={item.stock_quantity === 0 ? "text-red-600 font-semibold" : "text-amber-600 font-semibold"}>
                          {item.stock_quantity}
                        </span>
                      </td>
                      <td className="text-right text-text-muted">{item.low_stock_threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-5"><EmptyState message="All products are well-stocked" /></div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px] text-sm text-text-muted">
      {message}
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "partial") return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="destructive">Unpaid</Badge>;
}
