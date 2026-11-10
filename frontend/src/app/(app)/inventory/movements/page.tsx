"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import type { InventoryMovement, ApiResponse } from "@/types";

const MOVEMENT_LABELS: Record<string, string> = {
  purchase_received: "Purchase Received",
  sale: "Sale",
  return_resalable: "Return (Resalable)",
  return_damaged: "Return (Damaged)",
  adjustment_add: "Adjustment (Add)",
  adjustment_deduct: "Adjustment (Deduct)",
  opening_stock: "Opening Stock",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
};

const MOVEMENT_COLORS: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  purchase_received: "success",
  sale: "destructive",
  return_resalable: "success",
  return_damaged: "warning",
  adjustment_add: "success",
  adjustment_deduct: "warning",
  opening_stock: "secondary",
};

export default function InventoryMovementsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-movements", page],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<InventoryMovement[]>>("/inventory/movements", {
        params: { page, page_size: 25 },
      });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const columns: Column<InventoryMovement>[] = [
    { key: "created_at", header: "Date", render: (m) => <span className="text-xs text-text-muted">{formatDateTime(m.created_at)}</span> },
    {
      key: "product",
      header: "Product / Variant",
      render: (m) => (
        <div>
          <p className="font-medium text-sm">{(m.variant as any)?.product?.name ?? "—"}</p>
          <p className="text-xs text-text-muted font-mono">{m.variant?.sku}</p>
        </div>
      ),
    },
    {
      key: "movement_type",
      header: "Type",
      render: (m) => (
        <Badge variant={MOVEMENT_COLORS[m.movement_type] ?? "secondary"} className="whitespace-nowrap">
          {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
        </Badge>
      ),
    },
    {
      key: "quantity",
      header: "Change",
      className: "text-right",
      render: (m) => (
        <span className={`font-semibold tabular-nums ${m.quantity > 0 ? "text-green-700" : "text-red-600"}`}>
          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
        </span>
      ),
    },
    { key: "quantity_before", header: "Before", className: "text-right", render: (m) => <span className="tabular-nums text-text-muted">{m.quantity_before}</span> },
    { key: "quantity_after", header: "After", className: "text-right", render: (m) => <span className="tabular-nums font-medium">{m.quantity_after}</span> },
    { key: "reason", header: "Reason", render: (m) => <span className="text-xs text-text-muted truncate max-w-[180px] block">{m.reason ?? "—"}</span> },
    { key: "performed_by", header: "By", render: (m) => <span className="text-xs">{m.performed_by_user?.full_name ?? "—"}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory Movements"
        description="Complete history of all stock changes"
        breadcrumbs={[{ label: "Inventory", href: "/inventory" }, { label: "Movements" }]}
      />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        emptyMessage="No inventory movements recorded yet."
        rowKey={(m) => m.id}
      />
    </div>
  );
}
