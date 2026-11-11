"use client";

import React, { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowLeft, Pencil, Save, X, Package } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { apiGet, apiPut, apiPost, getApiError, apiClient } from "@/lib/api";
import { formatMoney, formatDate, getStockStatusColor, getStockStatusLabel } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Store } from "lucide-react";
import type { Product, Category, ProductVariant, ApiResponse } from "@/types";

const variantSchema = z.object({
  size: z.string().optional(),
  colour: z.string().optional(),
  sku: z.string().optional(),
  selling_price_kobo: z.number().min(0),
  cost_price_kobo: z.number().min(0),
  initial_stock: z.number().min(0),
  low_stock_threshold: z.number().min(0),
});
type VariantForm = z.infer<typeof variantSchema>;

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const id = params.id as string;
  const [editMode, setEditMode] = useState(sp.get("edit") === "true");
  const [showVariantModal, setShowVariantModal] = useState(false);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => apiGet<Product>(`/products/${id}`),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/categories"),
  });

  // Edit product form
  const [editData, setEditData] = useState({
    name: "", description: "", brand: "", category_id: "",
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof editData) =>
      apiPut(`/products/${id}`, {
        ...data,
        category_id: data.category_id ? parseInt(data.category_id) : undefined,
      }),
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: ["product", id] });
      setEditMode(false);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  // Add variant form
  const variantForm = useForm<VariantForm>({
    resolver: zodResolver(variantSchema),
    defaultValues: { initial_stock: 0, low_stock_threshold: 5, selling_price_kobo: 0, cost_price_kobo: 0 },
  });

  const addVariantMutation = useMutation({
    mutationFn: (data: VariantForm) =>
      apiPost(`/products/${id}/variants`, data),
    onSuccess: () => {
      toast.success("Variant added");
      qc.invalidateQueries({ queryKey: ["product", id] });
      setShowVariantModal(false);
      variantForm.reset();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Loading…" />
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!product) return <div className="text-center text-text-muted py-20">Product not found.</div>;

  const startEdit = () => {
    setEditData({
      name: product.name,
      description: product.description ?? "",
      brand: product.brand ?? "",
      category_id: product.category_id ? String(product.category_id) : "",
    });
    setEditMode(true);
  };

  return (
    <div>
      <PageHeader
        title={editMode ? "Edit Product" : product.name}
        breadcrumbs={[{ label: "Products", href: "/products" }, { label: product.name }]}
        actions={
          <div className="flex gap-2">
            {!editMode ? (
              <>
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5" />Edit
                </Button>
                {product.is_active && (product.total_stock_units ?? 0) > 0 && (
                  <Button size="sm" asChild>
                    <Link href="/pos">
                      <Store className="h-3.5 w-3.5" />Sell
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                  <X className="h-3.5 w-3.5" />Cancel
                </Button>
                <Button size="sm" onClick={() => updateMutation.mutate(editData)}>
                  <Save className="h-3.5 w-3.5" />Save
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-3.5 w-3.5" />Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Product Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editMode ? (
              <>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={editData.name} onChange={(e) => setEditData(d => ({ ...d, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={3} value={editData.description} onChange={(e) => setEditData(d => ({ ...d, description: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Brand</Label>
                  <Input value={editData.brand} onChange={(e) => setEditData(d => ({ ...d, brand: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={editData.category_id} onValueChange={(v) => setEditData(d => ({ ...d, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="aspect-square rounded-md bg-background border border-border flex items-center justify-center overflow-hidden mb-4">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-16 w-16 text-gray-300" />
                  )}
                </div>
                <InfoRow label="Category" value={product.category?.name} />
                <InfoRow label="Brand" value={product.brand} />
                <InfoRow label="Status">
                  <Badge variant={product.is_active ? "success" : "outline"}>
                    {product.is_active ? "Active" : "Archived"}
                  </Badge>
                </InfoRow>
                <InfoRow label="Added" value={formatDate(product.created_at)} />
                {product.description && (
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-1">Description</p>
                    <p className="text-sm text-text-primary">{product.description}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Variants Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Variants ({product.variants?.length ?? 0})</CardTitle>
            <Button size="sm" onClick={() => setShowVariantModal(true)}>
              <Plus className="h-3.5 w-3.5" />Add Variant
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {(product.variants?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <Package className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No variants yet. Add sizes and colours.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase">SKU</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase">Size</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase">Colour</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Price</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Stock</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants?.map((v) => (
                    <tr key={v.id} className="border-b border-border hover:bg-background/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">{v.sku}</td>
                      <td className="px-4 py-3">{v.size ?? "—"}</td>
                      <td className="px-4 py-3">{v.colour ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMoney(v.selling_price_kobo)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{v.stock_quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getStockStatusColor(v.stock_status ?? "")}`}>
                          {getStockStatusLabel(v.stock_status ?? "")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Variant Modal */}
      <Dialog open={showVariantModal} onOpenChange={setShowVariantModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Variant</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={variantForm.handleSubmit((d) => addVariantMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Size</Label>
                <Input placeholder="e.g. M, L, XL, 32" {...variantForm.register("size")} />
              </div>
              <div className="space-y-1.5">
                <Label>Colour</Label>
                <Input placeholder="e.g. Black, Navy Blue" {...variantForm.register("colour")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>SKU <span className="text-text-muted text-xs">(leave blank to auto-generate)</span></Label>
              <Input placeholder="Auto-generated" {...variantForm.register("sku")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Selling Price (₦)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  onChange={(e) => variantForm.setValue("selling_price_kobo", Math.round(parseFloat(e.target.value || "0") * 100))}
                />
                {variantForm.formState.errors.selling_price_kobo && (
                  <p className="text-xs text-red-600">Required</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Cost Price (₦)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  onChange={(e) => variantForm.setValue("cost_price_kobo", Math.round(parseFloat(e.target.value || "0") * 100))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Initial Stock</Label>
                <Input type="number" defaultValue={0} {...variantForm.register("initial_stock", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Low Stock Alert</Label>
                <Input type="number" defaultValue={5} {...variantForm.register("low_stock_threshold", { valueAsNumber: true })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowVariantModal(false)}>Cancel</Button>
              <Button type="submit" disabled={addVariantMutation.isPending}>
                {addVariantMutation.isPending ? "Adding…" : "Add Variant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      {children ?? <span className="text-sm font-medium text-text-primary">{value ?? "—"}</span>}
    </div>
  );
}
