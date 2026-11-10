"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatMoney, getStockStatusColor, getStockStatusLabel } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import type { ProductVariant, ApiResponse } from "@/types";

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", page, search, stockFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, page_size: 25 };
      if (search) params.search = search;
      if (stockFilter) params.stock_status = stockFilter;
      const resp = await apiClient.get<ApiResponse<ProductVariant[]>>("/inventory", { params });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const columns: Column<ProductVariant>[] = [
    {
      key: "product",
      header: "Product",
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-background border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
            {v.product?.image_url ? (
              <img src={v.product.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-text-muted" />
            )}
          </div>
          <div>
            <p className="font-medium">{v.product?.name ?? "—"}</p>
            {v.product?.category && <p className="text-xs text-text-muted">{v.product.category.name}</p>}
          </div>
        </div>
      ),
    },
    { key: "sku", header: "SKU", render: (v) => <span className="font-mono text-xs text-text-muted">{v.sku}</span> },
    { key: "size", header: "Size", render: (v) => v.size ?? "—" },
    { key: "colour", header: "Colour", render: (v) => v.colour ?? "—" },
    {
      key: "stock_quantity", header: "In Stock", className: "text-right",
      render: (v) => <span className="font-semibold tabular-nums">{v.stock_quantity}</span>,
    },
    {
      key: "cost_price_kobo", header: "Cost", className: "text-right",
      render: (v) => formatMoney(v.cost_price_kobo),
    },
    {
      key: "selling_price_kobo", header: "Price", className: "text-right",
      render: (v) => <span className="font-medium">{formatMoney(v.selling_price_kobo)}</span>,
    },
    {
      key: "stock_status", header: "Status",
      render: (v) => (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getStockStatusColor(v.stock_status ?? "")}`}>
          {getStockStatusLabel(v.stock_status ?? "")}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Current stock levels for all variants"
        breadcrumbs={[{ label: "Inventory" }]}
        actions={
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="All stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Stock</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search product or SKU…"
        emptyMessage="No inventory items found."
        rowKey={(v) => v.id}
      />
    </div>
  );
}
