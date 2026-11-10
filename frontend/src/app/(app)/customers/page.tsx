"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiClient, apiPost, apiPut, getApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import type { Customer, ApiResponse } from "@/types";

const emptyForm = { full_name: "", phone: "", email: "", address: "", notes: "" };

export default function CustomersPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, page_size: 20 };
      if (search) params.search = search;
      const resp = await apiClient.get<ApiResponse<Customer[]>>("/customers", { params });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => editTarget ? apiPut(`/customers/${editTarget.id}`, form) : apiPost("/customers", form),
    onSuccess: () => {
      toast.success(editTarget ? "Customer updated" : "Customer registered");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setShowModal(false);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({ full_name: c.full_name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", notes: c.notes ?? "" });
    setShowModal(true);
  };

  const columns: Column<Customer>[] = [
    { key: "full_name", header: "Name", render: (c) => <span className="font-medium">{c.full_name}</span> },
    { key: "phone", header: "Phone", render: (c) => c.phone ?? "—" },
    { key: "email", header: "Email", render: (c) => <span className="text-text-muted">{c.email ?? "—"}</span> },
    { key: "created_at", header: "Registered", render: (c) => <span className="text-text-muted">{formatDate(c.created_at)}</span> },
    {
      key: "actions", header: "", className: "w-10",
      render: (c) => hasPermission("customers:manage") ? (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Registered customer profiles"
        breadcrumbs={[{ label: "Customers" }]}
        actions={hasPermission("customers:manage") ? (
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Register Customer</Button>
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
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search name or phone…"
        emptyMessage="No registered customers."
        rowKey={(c) => c.id}
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editTarget ? "Edit Customer" : "Register Customer"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button disabled={!form.full_name || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
