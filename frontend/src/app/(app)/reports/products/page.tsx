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
import type { ApiResponse } from "@/types";

interface ProductRow { product_id: string; product_name: string; sku: string; size: string; colour: string; qty_sold: number; revenue_kobo: number; profit_kobo: number; }

export default function ProductsReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);
  const [params, setParams] = useState({ from, to });

  const { data, isLoading } = useQuery({
    queryKey: ["report-products", params],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<{ rows: ProductRow[] }>>("/reports/products", { params });
      return resp.data.data?.rows ?? [];
    },
  });

  return (
    <div>
      <PageHeader title="Product Performance" description="Best-selling products by revenue and profit" breadcrumbs={[{ label: "Reports" }, { label: "Products" }]} />

      <div className="flex items-end gap-3 mb-6">
        <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
        <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        <Button onClick={() => setParams({ from, to })}>Apply</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Top Products by Quantity Sold</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !data?.length ? (
            <div className="p-10 text-center text-text-muted text-sm">No sales data for this period</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>#</th><th>Product</th><th>SKU</th><th>Size</th><th>Colour</th>
                <th className="text-right">Qty Sold</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Profit</th>
              </tr></thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.sku}>
                    <td className="text-text-muted tabular-nums">{i + 1}</td>
                    <td className="font-medium">{row.product_name}</td>
                    <td className="font-mono text-xs text-text-muted">{row.sku}</td>
                    <td>{row.size || "—"}</td>
                    <td>{row.colour || "—"}</td>
                    <td className="text-right font-semibold tabular-nums">{row.qty_sold}</td>
                    <td className="text-right tabular-nums">{formatMoney(row.revenue_kobo)}</td>
                    <td className="text-right tabular-nums text-green-700 font-medium">{formatMoney(row.profit_kobo)}</td>
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
