"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Layers, AlertTriangle, XCircle } from "lucide-react";
import type { ApiResponse } from "@/types";

interface InventoryReport {
  total_units: number; total_cost_kobo: number;
  total_value_kobo: number; low_stock_count: number; out_of_stock_count: number;
}

export default function InventoryReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-inventory"],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<InventoryReport>>("/reports/inventory");
      return resp.data.data;
    },
  });

  const metrics = [
    { label: "Total Stock Units", value: data?.total_units.toLocaleString() ?? "—", icon: Layers, color: "text-brand-purple", bg: "bg-brand-purple-light" },
    { label: "Stock at Cost", value: data ? formatMoney(data.total_cost_kobo) : "—", icon: Package, color: "text-brand-orange", bg: "bg-brand-orange-light" },
    { label: "Stock at Retail", value: data ? formatMoney(data.total_value_kobo) : "—", sub: "Potential revenue if all sold", icon: Package, color: "text-green-700", bg: "bg-green-50" },
    { label: "Low Stock Variants", value: data?.low_stock_count.toLocaleString() ?? "—", sub: "At or below threshold", icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50" },
    { label: "Out of Stock", value: data?.out_of_stock_count.toLocaleString() ?? "—", sub: "Zero available", icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    {
      label: "Potential Margin",
      value: data && data.total_cost_kobo > 0 ? `${(((data.total_value_kobo - data.total_cost_kobo) / data.total_cost_kobo) * 100).toFixed(1)}%` : "—",
      sub: "Retail vs cost markup",
      icon: Layers, color: "text-brand-purple", bg: "bg-brand-purple-light"
    },
  ];

  return (
    <div>
      <PageHeader title="Inventory Report" description="Current stock snapshot" breadcrumbs={[{ label: "Reports" }, { label: "Inventory" }]} />
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div key={label} className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
                  <p className={`mt-1.5 text-2xl font-semibold ${color}`}>{value}</p>
                  {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
