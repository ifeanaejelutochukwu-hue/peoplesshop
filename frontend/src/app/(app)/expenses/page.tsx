"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient, apiGet, apiPost, apiDelete, getApiError } from "@/lib/api";
import { formatMoney, formatDate, nairaToKobo } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/store/auth";
import type { Expense, ExpenseCategory, ApiResponse } from "@/types";

const emptyForm = { expense_category_id: "", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0], payment_method: "cash", notes: "" };

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ["expense-categories"],
    queryFn: () => apiGet<ExpenseCategory[]>("/expenses/categories"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", page],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<Expense[]>>("/expenses", { params: { page, page_size: 20 } });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiPost("/expenses", {
      expense_category_id: parseInt(form.expense_category_id),
      description: form.description,
      amount_kobo: nairaToKobo(parseFloat(form.amount) || 0),
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      notes: form.notes,
    }),
    onSuccess: () => {
      toast.success("Expense recorded");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setShowModal(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/expenses/${id}`),
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const columns: Column<Expense>[] = [
    { key: "expense_date", header: "Date", render: (e) => <span className="text-text-muted">{formatDate(e.expense_date)}</span> },
    { key: "category", header: "Category", render: (e) => <span>{e.expense_category?.name ?? "—"}</span> },
    { key: "description", header: "Description", render: (e) => <span className="font-medium">{e.description}</span> },
    { key: "amount_kobo", header: "Amount", className: "text-right", render: (e) => <span className="font-semibold">{formatMoney(e.amount_kobo)}</span> },
    { key: "payment_method", header: "Method", render: (e) => <span className="text-xs capitalize text-text-muted">{e.payment_method?.replace("_", " ") ?? "—"}</span> },
    { key: "actions", header: "", className: "w-10", render: (e) => hasPermission("expenses:manage") ? (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget(e.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Expenses" description="Business operating expenses" breadcrumbs={[{ label: "Expenses" }]}
        actions={hasPermission("expenses:manage") ? (
          <Button size="sm" onClick={() => setShowModal(true)}><Plus className="h-4 w-4" />Record Expense</Button>
        ) : undefined}
      />
      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading}
        total={data?.meta?.total ?? 0} page={page} pageSize={20} onPageChange={setPage}
        emptyMessage="No expenses recorded yet." rowKey={(e) => e.id} />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.expense_category_id} onValueChange={(v) => setForm(f => ({ ...f, expense_category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount (₦) *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm(f => ({ ...f, expense_date: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="pos_card">POS / Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button disabled={!form.expense_category_id || !form.description || !form.amount || createMutation.isPending}
              onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Saving…" : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This expense record will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
