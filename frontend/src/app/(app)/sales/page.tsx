"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { apiClient, apiPost, getApiError } from "@/lib/api";
import { formatMoney, formatDateTime, getPaymentStatusColor } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth";
import type { Sale, ApiResponse } from "@/types";

export default function SalesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [reverseTarget, setReverseTarget] = useState<Sale | null>(null);
  const [reverseReason, setReverseReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sales", page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, page_size: 20 };
      if (search) params.search = search;
      const resp = await apiClient.get<ApiResponse<Sale[]>>("/sales", { params });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (sale: Sale) => apiPost(`/sales/${sale.id}/reverse`, { reason: reverseReason }),
    onSuccess: () => {
      toast.success("Sale reversed");
      qc.invalidateQueries({ queryKey: ["sales"] });
      setReverseTarget(null);
      setReverseReason("");
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const columns: Column<Sale>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (s) => (
        <Link href={`/sales/${s.id}`} className="font-mono text-xs font-medium text-brand-purple hover:underline">
          {s.reference}
        </Link>
      ),
    },
    { key: "created_at", header: "Date", render: (s) => <span className="text-xs text-text-muted">{formatDateTime(s.created_at)}</span> },
    { key: "customer", header: "Customer", render: (s) => s.customer?.full_name ?? "—" },
    { key: "served_by", header: "Attendant", render: (s) => s.served_by_user?.full_name ?? "—" },
    {
      key: "total_kobo", header: "Total", className: "text-right",
      render: (s) => <span className="font-medium tabular-nums">{formatMoney(s.total_kobo)}</span>,
    },
    {
      key: "payment_status", header: "Payment",
      render: (s) => (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getPaymentStatusColor(s.payment_status)}`}>
          {s.payment_status.charAt(0).toUpperCase() + s.payment_status.slice(1)}
        </span>
      ),
    },
    {
      key: "status", header: "Status",
      render: (s) => (
        <Badge variant={s.status === "completed" ? "success" : s.status === "reversed" ? "warning" : "destructive"}>
          {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: "actions", header: "", className: "w-20",
      render: (s) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href={`/sales/${s.id}`}><Eye className="h-3.5 w-3.5" /></Link>
          </Button>
          {hasPermission("sales:reverse") && s.status === "completed" && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700"
              onClick={() => setReverseTarget(s)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Sales" description="All transactions" breadcrumbs={[{ label: "Sales" }]} />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search reference…"
        emptyMessage="No sales yet."
        rowKey={(s) => s.id}
      />

      <Dialog open={!!reverseTarget} onOpenChange={(o) => !o && setReverseTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reverse Sale {reverseTarget?.reference}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              This will mark the sale as reversed and restore inventory. This action cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Input
                placeholder="Reason for reversal…"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!reverseReason || reverseMutation.isPending}
              onClick={() => reverseTarget && reverseMutation.mutate(reverseTarget)}
            >
              {reverseMutation.isPending ? "Reversing…" : "Reverse Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
