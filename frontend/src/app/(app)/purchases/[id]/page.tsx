"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost, getApiError } from "@/lib/api";
import { formatMoney, formatDate, getPaymentStatusColor } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth";
import type { Purchase } from "@/types";

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});

  const { data: purchase, isLoading } = useQuery<Purchase>({
    queryKey: ["purchase", id],
    queryFn: () => apiGet<Purchase>(`/purchases/${id}`),
  });

  const receiveMutation = useMutation({
    mutationFn: () => apiPost(`/purchases/${id}/receive`, {
      items: Object.entries(receiveQtys)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => ({ item_id: itemId, qty_received: qty })),
    }),
    onSuccess: () => {
      toast.success("Stock received and inventory updated");
      qc.invalidateQueries({ queryKey: ["purchase", id] });
      setReceiveOpen(false);
      setReceiveQtys({});
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;
  if (!purchase) return <div className="text-center py-20 text-text-muted">Purchase not found.</div>;

  const receivingStatusVariant = {
    pending: "outline", partial: "warning", received: "success", cancelled: "destructive",
  } as const;

  return (
    <div>
      <PageHeader
        title={purchase.reference}
        breadcrumbs={[{ label: "Purchases", href: "/purchases" }, { label: purchase.reference }]}
        actions={
          <div className="flex gap-2">
            {hasPermission("purchases:receive") && purchase.receiving_status !== "received" && purchase.receiving_status !== "cancelled" && (
              <Button size="sm" onClick={() => setReceiveOpen(true)}>
                <PackageCheck className="h-4 w-4" />Receive Stock
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {[
              ["Supplier", purchase.supplier?.name ?? "—"],
              ["Date", formatDate(purchase.purchase_date)],
              ["Total", formatMoney(purchase.total_kobo)],
              ["Amount Paid", formatMoney(purchase.amount_paid_kobo)],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-border pb-2 last:border-0">
                <span className="text-text-muted">{l}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-muted">Payment</span>
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getPaymentStatusColor(purchase.payment_status)}`}>
                {purchase.payment_status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Receiving</span>
              <Badge variant={receivingStatusVariant[purchase.receiving_status as keyof typeof receivingStatusVariant] ?? "outline"}>
                {purchase.receiving_status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase">Product</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Ordered</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Received</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Outstanding</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Unit Cost</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items?.map((item) => {
                  const outstanding = item.quantity_ordered - item.quantity_received;
                  return (
                    <tr key={item.id} className="border-b border-border hover:bg-background/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.variant?.product?.name}</p>
                        <p className="text-xs text-text-muted">
                          {[item.variant?.size, item.variant?.colour].filter(Boolean).join(" / ")} · {item.variant?.sku}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.quantity_ordered}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700 font-medium">{item.quantity_received}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={outstanding > 0 ? "text-amber-600 font-medium" : "text-text-muted"}>{outstanding}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatMoney(item.unit_cost_kobo)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMoney(item.total_cost_kobo)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border bg-background">
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right font-bold">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-purple">{formatMoney(purchase.total_kobo)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Receive Stock Modal */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Receive Stock</DialogTitle></DialogHeader>
          <p className="text-sm text-text-muted">Enter the quantity actually received for each item. Leave blank or 0 to skip.</p>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {purchase.items?.filter(i => i.quantity_ordered > i.quantity_received).map((item) => {
              const outstanding = item.quantity_ordered - item.quantity_received;
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-md border border-border">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.variant?.product?.name}</p>
                    <p className="text-xs text-text-muted">{[item.variant?.size, item.variant?.colour].filter(Boolean).join(" / ")} — outstanding: {outstanding}</p>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs text-text-muted">Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      max={outstanding}
                      placeholder="0"
                      value={receiveQtys[item.id] ?? ""}
                      onChange={(e) => setReceiveQtys(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button
              disabled={Object.values(receiveQtys).every(q => q <= 0) || receiveMutation.isPending}
              onClick={() => receiveMutation.mutate()}
            >
              {receiveMutation.isPending ? "Updating…" : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
