"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatMoney, formatDateTime, getPaymentStatusColor } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sale } from "@/types";

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: sale, isLoading } = useQuery<Sale>({
    queryKey: ["sale", id],
    queryFn: () => apiGet<Sale>(`/sales/${id}`),
  });

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;
  if (!sale) return <div className="text-center py-20 text-text-muted">Sale not found.</div>;

  return (
    <div>
      <PageHeader
        title={`Sale ${sale.reference}`}
        breadcrumbs={[{ label: "Sales", href: "/sales" }, { label: sale.reference }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />Print
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-3.5 w-3.5" />Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {[
              ["Reference", sale.reference],
              ["Date", formatDateTime(sale.created_at)],
              ["Customer", sale.customer?.full_name ?? "Walk-in"],
              ["Served by", sale.served_by_user?.full_name ?? "—"],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-border pb-2 last:border-0">
                <span className="text-text-muted">{l}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-muted">Payment</span>
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getPaymentStatusColor(sale.payment_status)}`}>
                {sale.payment_status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Status</span>
              <Badge variant={sale.status === "completed" ? "success" : "warning"}>
                {sale.status}
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
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Unit</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items?.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.variant?.product?.name}</p>
                      <p className="text-xs text-text-muted">
                        {[item.variant?.size, item.variant?.colour].filter(Boolean).join(" / ")} · {item.variant?.sku}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.unit_price_kobo)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(item.total_price_kobo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-background">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-right text-sm font-semibold">Subtotal</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatMoney(sale.subtotal_kobo)}</td>
                </tr>
                {sale.discount_kobo > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-sm text-text-muted">Discount</td>
                    <td className="px-4 py-2 text-right text-red-600">-{formatMoney(sale.discount_kobo)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-right font-bold">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-lg text-brand-purple">{formatMoney(sale.total_kobo)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {sale.payments?.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="capitalize text-text-muted">{p.payment_method.replace("_", " ")}</span>
                <span className="font-medium">{formatMoney(p.amount_kobo)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
              <span>Amount Paid</span>
              <span className="text-green-700">{formatMoney(sale.amount_paid_kobo)}</span>
            </div>
            {sale.total_kobo - sale.amount_paid_kobo > 0 && (
              <div className="flex justify-between text-sm font-semibold text-amber-700">
                <span>Balance</span>
                <span>{formatMoney(sale.total_kobo - sale.amount_paid_kobo)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
