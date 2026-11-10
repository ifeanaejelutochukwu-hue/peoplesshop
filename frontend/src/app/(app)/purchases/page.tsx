"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Eye } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatMoney, formatDate, getPaymentStatusColor } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/tables/data-table";
import { useAuthStore } from "@/store/auth";
import type { Purchase, ApiResponse } from "@/types";

export default function PurchasesPage() {
  const { hasPermission } = useAuthStore();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["purchases", page],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<Purchase[]>>("/purchases", { params: { page, page_size: 20 } });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const columns: Column<Purchase>[] = [
    { key: "reference", header: "Reference", render: (p) => <Link href={`/purchases/${p.id}`} className="font-mono text-xs font-medium text-brand-purple hover:underline">{p.reference}</Link> },
    { key: "supplier", header: "Supplier", render: (p) => p.supplier?.name ?? "—" },
    { key: "purchase_date", header: "Date", render: (p) => <span className="text-text-muted">{formatDate(p.purchase_date)}</span> },
    { key: "total_kobo", header: "Total", className: "text-right", render: (p) => <span className="font-medium">{formatMoney(p.total_kobo)}</span> },
    { key: "payment_status", header: "Payment", render: (p) => <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getPaymentStatusColor(p.payment_status)}`}>{p.payment_status}</span> },
    {
      key: "receiving_status", header: "Receiving",
      render: (p) => {
        const v = { pending: "outline", partial: "warning", received: "success", cancelled: "destructive" } as const;
        return <Badge variant={v[p.receiving_status as keyof typeof v] ?? "outline"}>{p.receiving_status}</Badge>;
      },
    },
    {
      key: "actions", header: "", className: "w-10",
      render: (p) => <Button variant="ghost" size="icon" className="h-7 w-7" asChild><Link href={`/purchases/${p.id}`}><Eye className="h-3.5 w-3.5" /></Link></Button>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Stock purchase orders"
        breadcrumbs={[{ label: "Purchases" }]}
        actions={hasPermission("purchases:create") ? (
          <Button size="sm" asChild><Link href="/purchases/new"><Plus className="h-4 w-4" />New Purchase</Link></Button>
        ) : undefined}
      />
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} total={data?.meta?.total ?? 0} page={page} pageSize={20} onPageChange={setPage} emptyMessage="No purchase orders yet." rowKey={(p) => p.id} />
    </div>
  );
}
