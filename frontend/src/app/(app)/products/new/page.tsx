"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { apiClient, apiPost, getApiError } from "@/lib/api";
import { nairaToKobo } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category, Product, ApiResponse } from "@/types";

interface VariantRow {
  size: string;
  colour: string;
  selling_price: string;
  cost_price: string;
  initial_stock: string;
  low_stock_threshold: string;
}

const blankVariant = (): VariantRow => ({
  size: "", colour: "", selling_price: "", cost_price: "", initial_stock: "0", low_stock_threshold: "5",
});

export default function NewProductPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([blankVariant()]);
  const [saving, setSaving] = useState(false);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<Category[]>>("/categories");
      return resp.data.data ?? [];
    },
  });

  const updateVariant = (i: number, field: keyof VariantRow, value: string) => {
    setVariants(prev => prev.map((v, j) => j === i ? { ...v, [field]: value } : v));
  };

  const addVariantRow = () => setVariants(prev => [...prev, blankVariant()]);

  const removeVariantRow = (i: number) => {
    if (variants.length === 1) return; // keep at least one
    setVariants(prev => prev.filter((_, j) => j !== i));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Product name is required"); return; }
    const hasPrice = variants.some(v => v.selling_price && parseFloat(v.selling_price) > 0);
    if (!hasPrice) { toast.error("At least one variant needs a selling price"); return; }

    setSaving(true);
    try {
      // 1. Create the product
      const productResp = await apiClient.post<ApiResponse<Product>>("/products", {
        name: name.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        category_id: categoryId ? parseInt(categoryId) : undefined,
      });
      const product = productResp.data.data!;

      // 2. Create all variants
      const variantPromises = variants
        .filter(v => v.selling_price) // skip empty rows
        .map(v =>
          apiClient.post(`/products/${product.id}/variants`, {
            size: v.size.trim() || undefined,
            colour: v.colour.trim() || undefined,
            selling_price_kobo: nairaToKobo(parseFloat(v.selling_price) || 0),
            cost_price_kobo: nairaToKobo(parseFloat(v.cost_price) || 0),
            initial_stock: parseInt(v.initial_stock) || 0,
            low_stock_threshold: parseInt(v.low_stock_threshold) || 5,
          })
        );
      await Promise.all(variantPromises);

      toast.success(`${name} created with ${variantPromises.length} variant${variantPromises.length !== 1 ? "s" : ""}`);
      router.push(`/products/${product.id}`);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="New Product"
        breadcrumbs={[{ label: "Products", href: "/products" }, { label: "New" }]}
      />

      <div className="max-w-3xl space-y-5">
        {/* Product basics */}
        <Card>
          <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product Name *</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Classic Polo Shirt"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Brand <span className="text-text-muted text-xs">(optional)</span></Label>
                <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Nike, Zara" />
              </div>
              <div className="space-y-1.5">
                <Label>Category <span className="text-text-muted text-xs">(optional)</span></Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-text-muted text-xs">(optional)</span></Label>
              <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description…" />
            </div>
          </CardContent>
        </Card>

        {/* Variants */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sizes & Colours (Variants)</CardTitle>
                <p className="text-xs text-text-muted mt-0.5">Each size/colour combination is a separate variant with its own price and stock.</p>
              </div>
              <Button size="sm" variant="outline" onClick={addVariantRow}>
                <Plus className="h-3.5 w-3.5" />Add Row
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide px-1">
                <div className="col-span-2">Size</div>
                <div className="col-span-2">Colour</div>
                <div className="col-span-2">Sell Price (₦) *</div>
                <div className="col-span-2">Cost Price (₦)</div>
                <div className="col-span-2">Stock</div>
                <div className="col-span-1">Alert</div>
                <div className="col-span-1"></div>
              </div>

              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <Input
                      placeholder="e.g. M"
                      value={v.size}
                      onChange={e => updateVariant(i, "size", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="e.g. Black"
                      value={v.colour}
                      onChange={e => updateVariant(i, "colour", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={v.selling_price}
                      onChange={e => updateVariant(i, "selling_price", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={v.cost_price}
                      onChange={e => updateVariant(i, "cost_price", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={v.initial_stock}
                      onChange={e => updateVariant(i, "initial_stock", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="0"
                      placeholder="5"
                      value={v.low_stock_threshold}
                      onChange={e => updateVariant(i, "low_stock_threshold", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-text-muted hover:text-red-500"
                      onClick={() => removeVariantRow(i)}
                      disabled={variants.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-text-muted mt-4">
              If this product has no sizes or colours, just fill in the price and stock — leave Size and Colour blank.
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <Button size="lg" onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating…" : "Create Product"}
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
