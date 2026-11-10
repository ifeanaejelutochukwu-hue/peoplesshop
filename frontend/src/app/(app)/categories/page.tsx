"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost, apiPut, apiDelete, getApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/store/auth";
import type { Category } from "@/types";

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/categories"),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editTarget
        ? apiPut(`/categories/${editTarget.id}`, form)
        : apiPost("/categories", form),
    onSuccess: () => {
      toast.success(editTarget ? "Category updated" : "Category created");
      qc.invalidateQueries({ queryKey: ["categories"] });
      closeModal();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/categories/${id}`),
    onSuccess: () => {
      toast.success("Category deleted");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const openCreate = () => { setEditTarget(null); setForm({ name: "", description: "" }); setShowModal(true); };
  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setForm({ name: cat.name, description: cat.description ?? "" });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const columns: Column<Category>[] = [
    { key: "name", header: "Name", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "description", header: "Description", render: (c) => c.description ?? <span className="text-text-muted">—</span> },
    { key: "created_at", header: "Created", render: (c) => <span className="text-text-muted">{formatDate(c.created_at)}</span> },
    {
      key: "actions", header: "", className: "w-20",
      render: (c) => (
        <div className="flex gap-1">
          {hasPermission("categories:manage") && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => setDeleteTarget(c)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organise your products into categories"
        breadcrumbs={[{ label: "Categories" }]}
        actions={
          hasPermission("categories:manage") ? (
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />New Category</Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={categories ?? []}
        isLoading={isLoading}
        emptyMessage="No categories. Create one to organise your products."
        rowKey={(c) => String(c.id)}
      />

      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Shirts" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be deleted. Products in this category will become uncategorised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
