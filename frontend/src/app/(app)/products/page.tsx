"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, Pencil, Trash2, Eye, Store } from "lucide-react";
import { toast } from "sonner";

import { apiClient, apiDelete, getApiError } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/tables/data-table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/store/auth";
import type { Product, ApiResponse } from "@/types";

export default function ProductsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Single clean query — no duplication
  const { data, isLoading } = useQuery({
    queryKey: ["products", page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, page_size: 20 };
      if (search) params.search = search;
      const resp = await apiClient.get<ApiResponse<Product[]>>("/products", { params });
      return { items: resp.data.data ?? [], meta: resp.data.meta };
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Product archived");
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Product",
      render: (p) => (
        <Link href={`/products/${p.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="h-9 w-9 rounded-md bg-background border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-text-muted" />
            )}
          </div>
          <div>
            <p className="font-medium text-text-primary">{p.name}</p>
            {p.brand && <p className="text-xs text-text-muted">{p.brand}</p>}
          </div>
        </Link>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (p) => p.category?.name
        ? <span className="text-sm">{p.category.name}</span>
        : <span className="text-text-muted">—</span>,
    },
    {
      key: "stock",
      header: "Stock",
      className: "text-right",
      render: (p) => (
        <span className={`tabular-nums font-medium ${(p.total_stock_units ?? 0) === 0 ? "text-red-500" : (p.total_stock_units ?? 0) <= 5 ? "text-amber-600" : "text-text-primary"}`}>
          {(p.total_stock_units ?? 0).toLocaleString()} units
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <Badge variant={p.is_active ? "success" : "outline"}>
          {p.is_active ? "Active" : "Archived"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Added",
      render: (p) => <span className="text-text-muted">{formatDate(p.created_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/products/${p.id}`}>
                <Eye className="h-3.5 w-3.5 mr-2" />View & Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/products/${p.id}`}>
                <Plus className="h-3.5 w-3.5 mr-2" />Add Variant
              </Link>
            </DropdownMenuItem>
            {hasPermission("pos:access") && p.is_active && (p.total_stock_units ?? 0) > 0 && (
              <DropdownMenuItem asChild>
                <Link href={`/pos?product=${p.id}`}>
                  <Store className="h-3.5 w-3.5 mr-2" />Sell This
                </Link>
              </DropdownMenuItem>
            )}
            {hasPermission("products:delete") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => setDeleteTarget(p)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />Archive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your clothing catalogue"
        breadcrumbs={[{ label: "Products" }]}
        actions={
          hasPermission("products:create") ? (
            <Button asChild>
              <Link href="/products/new"><Plus className="h-4 w-4" />Add Product</Link>
            </Button>
          ) : undefined
        }
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
        searchPlaceholder="Search products…"
        emptyMessage="No products yet. Click 'Add Product' to get started."
        rowKey={(p) => p.id}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive product?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be archived and hidden from the POS.
              Existing sales records will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && archiveMutation.mutate(deleteTarget.id)}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
