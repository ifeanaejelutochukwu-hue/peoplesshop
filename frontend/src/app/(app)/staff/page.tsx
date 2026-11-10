"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { apiClient, apiGet, apiPost, apiPatch, getApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { User, Role, ApiResponse } from "@/types";

export default function StaffPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: "", username: "", email: "", password: "", role_name: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["staff", page],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<User[]>>("/staff", { params: { page, page_size: 20 } });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: () => apiGet<Role[]>("/roles"),
  });

  const createMutation = useMutation({
    mutationFn: () => apiPost("/staff", form),
    onSuccess: () => { toast.success("Staff account created"); qc.invalidateQueries({ queryKey: ["staff"] }); setShowModal(false); setForm({ full_name: "", username: "", email: "", password: "", role_name: "" }); },
    onError: (err) => toast.error(getApiError(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiPatch(`/staff/${id}/status`, { is_active: active }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: (err) => toast.error(getApiError(err)),
  });

  const columns: Column<User>[] = [
    { key: "full_name", header: "Name", render: (u) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-brand-purple-light flex items-center justify-center text-brand-purple text-xs font-semibold">
          {u.full_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium">{u.full_name}</p>
          <p className="text-xs text-text-muted">@{u.username}</p>
        </div>
      </div>
    )},
    { key: "role", header: "Role", render: (u) => <Badge variant="secondary" className="capitalize">{u.role.name}</Badge> },
    { key: "is_active", header: "Status", render: (u) => <Badge variant={u.is_active ? "success" : "outline"}>{u.is_active ? "Active" : "Inactive"}</Badge> },
    { key: "last_login_at", header: "Last Login", render: (u) => <span className="text-xs text-text-muted">{u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}</span> },
    { key: "created_at", header: "Created", render: (u) => <span className="text-xs text-text-muted">{formatDateTime(u.created_at)}</span> },
    { key: "actions", header: "", className: "w-10", render: (u) => (
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => toggleMutation.mutate({ id: u.id, active: !u.is_active })}
        title={u.is_active ? "Deactivate" : "Activate"}>
        {u.is_active ? <UserX className="h-3.5 w-3.5 text-red-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-600" />}
      </Button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Staff" description="Employee accounts and permissions" breadcrumbs={[{ label: "Staff" }]}
        actions={<Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4" />Add Staff</Button>}
      />
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading}
        total={data?.meta?.total ?? 0} page={page} pageSize={20} onPageChange={setPage}
        emptyMessage="No staff accounts." rowKey={(u) => u.id} />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Staff Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Username *</Label><Input value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role_name} onValueChange={(v) => setForm(f => ({ ...f, role_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roles?.map(r => <SelectItem key={r.id} value={r.name} className="capitalize">{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button disabled={!form.full_name || !form.username || !form.password || !form.role_name || createMutation.isPending}
              onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating…" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
