"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Receipt, BarChart2 } from "lucide-react";
import type { ApiResponse } from "@/types";

interface ProfitSummary {
  total_revenue_kobo: number; total_cogs_kobo: number;
  gross_profit_kobo: number; total_expenses_kobo: number; net_profit_kobo: number;
}

export default function ProfitReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);
  const [params, setParams] = useState({ from, to });

  const { data, isLoading } = useQuery({
    queryKey: ["report-profit", params],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<{ summary: ProfitSummary }>>("/reports/profit", { params });
      return resp.data.data?.summary;
    },
  });

  const gpMargin = data && data.total_revenue_kobo > 0
    ? ((data.gross_profit_kobo / data.total_revenue_kobo) * 100).toFixed(1)
    : "0.0";
  const npMargin = data && data.total_revenue_kobo > 0
    ? ((data.net_profit_kobo / data.total_revenue_kobo) * 100).toFixed(1)
    : "0.0";

  const metrics = [
    { label: "Total Revenue", value: data ? formatMoney(data.total_revenue_kobo) : "—", icon: ShoppingBag, color: "text-brand-purple", bg: "bg-brand-purple-light" },
    { label: "Cost of Goods", value: data ? formatMoney(data.total_cogs_kobo) : "—", icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
    { label: "Gross Profit", value: data ? formatMoney(data.gross_profit_kobo) : "—", sub: `${gpMargin}% margin`, icon: TrendingUp, color: "text-green-700", bg: "bg-green-50" },
    { label: "Operating Expenses", value: data ? formatMoney(data.total_expenses_kobo) : "—", icon: Receipt, color: "text-amber-700", bg: "bg-amber-50" },
    { label: "Net Operating Profit", value: data ? formatMoney(data.net_profit_kobo) : "—", sub: `${npMargin}% margin`, icon: DollarSign, color: data?.net_profit_kobo && data.net_profit_kobo >= 0 ? "text-green-700" : "text-red-600", bg: data?.net_profit_kobo && data.net_profit_kobo >= 0 ? "bg-green-50" : "bg-red-50" },
    { label: "Gross Profit Margin", value: `${gpMargin}%`, icon: BarChart2, color: "text-brand-orange", bg: "bg-brand-orange-light" },
  ];

  return (
    <div>
      <PageHeader title="Profit Report" breadcrumbs={[{ label: "Reports" }, { label: "Profit" }]} />

      <div className="flex items-end gap-3 mb-6">
        <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
        <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        <Button onClick={() => setParams({ from, to })}>Apply</Button>
      </div>

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

      <Card className="mt-6">
        <CardHeader><CardTitle>How This Is Calculated</CardTitle></CardHeader>
        <CardContent className="text-sm text-text-muted space-y-2">
          <p><strong>Revenue</strong> = Sum of all completed sale totals in the period.</p>
          <p><strong>Cost of Goods Sold (COGS)</strong> = Sum of cost prices × quantities for all items sold (locked at time of sale).</p>
          <p><strong>Gross Profit</strong> = Revenue − COGS.</p>
          <p><strong>Operating Expenses</strong> = Sum of recorded business expenses in the period.</p>
          <p><strong>Net Operating Profit</strong> = Gross Profit − Operating Expenses. This is an estimate; it does not include depreciation, taxes or other non-recorded costs.</p>
        </CardContent>
      </Card>
    </div>
  );
}
