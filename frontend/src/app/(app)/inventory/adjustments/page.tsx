"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiClient, apiPost, getApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import type { StockAdjustment, ApiResponse } from "@/types";

export default function AdjustmentsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ variant_id: "", quantity: 0, reason: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["adjustments", page],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<StockAdjustment[]>>("/inventory/adjustments", { params: { page, page_size: 20 } });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const mutation = useMutation({
    mutationFn: () => apiPost("/inventory/adjustments", form),
    onSuccess: () => {
      toast.success("Adjustment recorded");
      qc.invalidateQueries({ queryKey: ["adjustments"] });
      setShowModal(false);
      setForm({ variant_id: "", quantity: 0, reason: "" });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const columns: Column<StockAdjustment>[] = [
    { key: "reference", header: "Reference", render: (a) => <span className="font-mono text-xs">{a.reference}</span> },
    { key: "product", header: "Product", render: (a) => (
      <div>
        <p className="font-medium text-sm">{a.variant?.product?.name ?? "—"}</p>
        <p className="text-xs text-text-muted">{[a.variant?.size, a.variant?.colour].filter(Boolean).join(" / ")} · {a.variant?.sku}</p>
      </div>
    )},
    { key: "quantity", header: "Quantity", className: "text-right", render: (a) => (
      <span className={`font-semibold tabular-nums ${a.quantity > 0 ? "text-green-700" : "text-red-600"}`}>
        {a.quantity > 0 ? `+${a.quantity}` : a.quantity}
      </span>
    )},
    { key: "reason", header: "Reason", render: (a) => <span className="text-sm text-text-muted">{a.reason}</span> },
    { key: "created_at", header: "Date", render: (a) => <span className="text-xs text-text-muted">{formatDateTime(a.created_at)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Adjustments"
        description="Manual corrections to inventory levels"
        breadcrumbs={[{ label: "Inventory", href: "/inventory" }, { label: "Adjustments" }]}
        actions={hasPermission("inventory:adjust") ? (
          <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4" />New Adjustment</Button>
        ) : undefined}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        emptyMessage="No adjustments recorded."
        rowKey={(a) => a.id}
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Stock Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Variant ID</Label>
              <Input placeholder="Paste variant UUID" value={form.variant_id} onChange={(e) => setForm(f => ({ ...f, variant_id: e.target.value }))} />
              <p className="text-xs text-text-muted">Go to the product page to find the variant ID, or use the inventory overview.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity <span className="text-text-muted">(negative to deduct)</span></Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Textarea rows={2} placeholder="e.g. 2 items damaged during storage" value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button disabled={!form.variant_id || !form.reason || form.quantity === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving…" : "Record Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
