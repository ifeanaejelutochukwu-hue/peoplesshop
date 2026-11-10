"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { ApiResponse } from "@/types";

interface SalesRow { date: string; total_sales_kobo: number; total_cogs_kobo: number; gross_profit_kobo: number; transaction_count: number; }

export default function SalesReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);
  const [params, setParams] = useState({ from, to });

  const { data, isLoading } = useQuery({
    queryKey: ["report-sales", params],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<{ from: string; to: string; rows: SalesRow[] }>>("/reports/sales", { params });
      return resp.data.data;
    },
  });

  const rows = data?.rows ?? [];
  const totals = rows.reduce((acc, r) => ({
    sales: acc.sales + r.total_sales_kobo,
    cogs: acc.cogs + r.total_cogs_kobo,
    profit: acc.profit + r.gross_profit_kobo,
    txns: acc.txns + r.transaction_count,
  }), { sales: 0, cogs: 0, profit: 0, txns: 0 });

  const chartData = rows.map(r => ({
    date: r.date,
    Revenue: r.total_sales_kobo / 100,
    "Gross Profit": r.gross_profit_kobo / 100,
  }));

  return (
    <div>
      <PageHeader title="Sales Report" breadcrumbs={[{ label: "Reports" }, { label: "Sales" }]} />

      {/* Date filter */}
      <div className="flex items-end gap-3 mb-6">
        <div className="space-y-1.5">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={() => setParams({ from, to })}>Apply</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Revenue", value: formatMoney(totals.sales) },
          { label: "Total COGS", value: formatMoney(totals.cogs) },
          { label: "Gross Profit", value: formatMoney(totals.profit) },
          { label: "Transactions", value: totals.txns.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <p className="text-xs text-text-muted uppercase tracking-wide">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Revenue vs Gross Profit</CardTitle></CardHeader>
        <CardContent className="h-64">
          {isLoading ? <Skeleton className="h-full" /> : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0E8" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`, ""]} contentStyle={{ fontSize: 12, borderColor: "#E2E0E8" }} />
                <Legend />
                <Bar dataKey="Revenue" fill="#7C3AC7" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Gross Profit" fill="#F5821E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Daily Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-sm">No sales data for selected period</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Date</th><th className="text-right">Revenue</th>
                <th className="text-right">COGS</th><th className="text-right">Gross Profit</th>
                <th className="text-right">Transactions</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.total_sales_kobo)}</td>
                    <td className="text-right tabular-nums text-text-muted">{formatMoney(r.total_cogs_kobo)}</td>
                    <td className="text-right tabular-nums font-medium text-green-700">{formatMoney(r.gross_profit_kobo)}</td>
                    <td className="text-right tabular-nums">{r.transaction_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
