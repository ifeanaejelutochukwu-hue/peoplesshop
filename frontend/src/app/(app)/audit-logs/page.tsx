"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import type { AuditLog, ApiResponse } from "@/types";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<AuditLog[]>>("/audit-logs", { params: { page, page_size: 25 } });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const columns: Column<AuditLog>[] = [
    { key: "created_at", header: "Time", render: (l) => <span className="text-xs text-text-muted whitespace-nowrap">{formatDateTime(l.created_at)}</span> },
    { key: "user", header: "User", render: (l) => <span className="text-sm">{l.user?.full_name ?? "System"}</span> },
    { key: "action", header: "Action", render: (l) => <Badge variant="secondary" className="font-mono text-xs">{l.action}</Badge> },
    { key: "resource_type", header: "Resource", render: (l) => l.resource_type ? (
      <span className="text-sm capitalize">{l.resource_type} {l.resource_id ? <span className="font-mono text-xs text-text-muted">#{l.resource_id.slice(0, 8)}</span> : ""}</span>
    ) : <span className="text-text-muted">—</span> },
    { key: "ip_address", header: "IP", render: (l) => <span className="font-mono text-xs text-text-muted">{l.ip_address ?? "—"}</span> },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" description="System activity trail" breadcrumbs={[{ label: "Audit Logs" }]} />
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading}
        total={data?.meta?.total ?? 0} page={page} pageSize={25} onPageChange={setPage}
        emptyMessage="No audit log entries." rowKey={(l) => String(l.id)} />
    </div>
  );
}
