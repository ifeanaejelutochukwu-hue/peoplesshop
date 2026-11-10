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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import type { Supplier, ApiResponse } from "@/types";

const emptyForm = { name: "", contact_person: "", phone: "", email: "", address: "", description: "", notes: "", is_active: true };

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, page_size: 20 };
      if (search) params.search = search;
      const resp = await apiClient.get<ApiResponse<Supplier[]>>("/suppliers", { params });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => editTarget ? apiPut(`/suppliers/${editTarget.id}`, form) : apiPost("/suppliers", form),
    onSuccess: () => {
      toast.success(editTarget ? "Supplier updated" : "Supplier created");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setShowModal(false);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s: Supplier) => {
    setEditTarget(s);
    setForm({ name: s.name, contact_person: s.contact_person ?? "", phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", description: s.description ?? "", notes: s.notes ?? "", is_active: s.is_active });
    setShowModal(true);
  };

  const columns: Column<Supplier>[] = [
    { key: "name", header: "Name", render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "contact_person", header: "Contact", render: (s) => s.contact_person ?? "—" },
    { key: "phone", header: "Phone", render: (s) => s.phone ?? "—" },
    { key: "email", header: "Email", render: (s) => s.email ?? "—" },
    { key: "is_active", header: "Status", render: (s) => <Badge variant={s.is_active ? "success" : "outline"}>{s.is_active ? "Active" : "Inactive"}</Badge> },
    { key: "created_at", header: "Added", render: (s) => <span className="text-text-muted">{formatDate(s.created_at)}</span> },
    {
      key: "actions", header: "", className: "w-10",
      render: (s) => hasPermission("suppliers:manage") ? (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Manage your stock suppliers"
        breadcrumbs={[{ label: "Suppliers" }]}
        actions={hasPermission("suppliers:manage") ? (
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />New Supplier</Button>
        ) : undefined}
      />
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} total={data?.meta?.total ?? 0} page={page} pageSize={20} onPageChange={setPage} searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Search suppliers…" emptyMessage="No suppliers yet." rowKey={(s) => s.id} />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? "Edit Supplier" : "New Supplier"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button disabled={!form.name || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
