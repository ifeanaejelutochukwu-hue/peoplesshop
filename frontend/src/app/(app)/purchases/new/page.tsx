"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost, getApiError } from "@/lib/api";
import { formatMoney, nairaToKobo, koboToNaira } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Supplier, Product, ProductVariant, Purchase } from "@/types";

interface LineItem { variantId: string; sku: string; productName: string; variantLabel: string; qty: number; unitCostKobo: number; }

export default function NewPurchasePage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");

  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers-all"], queryFn: () => apiGet<Supplier[]>("/suppliers?page=1&page_size=100") });
  const { data: productsData } = useQuery({ queryKey: ["products-all"], queryFn: async () => {
    const { apiClient } = await import("@/lib/api");
    const resp = await apiClient.get("/products?page=1&page_size=200");
    return resp.data.data as Product[];
  }});

  const selectedProductData = productsData?.find(p => p.id === selectedProduct);

  const addLine = () => {
    if (!selectedVariant) return;
    const variant = selectedProductData?.variants?.find(v => v.id === selectedVariant);
    if (!variant) return;
    if (lines.find(l => l.variantId === selectedVariant)) { toast.error("Variant already added"); return; }
    setLines(prev => [...prev, {
      variantId: variant.id, sku: variant.sku,
      productName: selectedProductData!.name,
      variantLabel: [variant.size, variant.colour].filter(Boolean).join(" / "),
      qty: 1, unitCostKobo: variant.cost_price_kobo || 0,
    }]);
    setSelectedVariant("");
  };

  const total = lines.reduce((s, l) => s + l.qty * l.unitCostKobo, 0);

  const mutation = useMutation({
    mutationFn: () => apiPost<Purchase>("/purchases", {
      supplier_id: supplierId,
      purchase_date: purchaseDate,
      items: lines.map(l => ({ variant_id: l.variantId, quantity: l.qty, unit_cost_kobo: l.unitCostKobo })),
    }),
    onSuccess: (p) => { toast.success("Purchase order created"); router.push(`/purchases/${p.id}`); },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <div>
      <PageHeader title="New Purchase Order" breadcrumbs={[{ label: "Purchases", href: "/purchases" }, { label: "New" }]} />
      <div className="max-w-3xl space-y-5">
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date</Label>
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add Items</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Select value={selectedProduct} onValueChange={v => { setSelectedProduct(v); setSelectedVariant(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{productsData?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Variant</Label>
                <Select value={selectedVariant} onValueChange={setSelectedVariant} disabled={!selectedProduct}>
                  <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                  <SelectContent>
                    {selectedProductData?.variants?.map(v => (
                      <SelectItem key={v.id} value={v.id}>{[v.size, v.colour].filter(Boolean).join(" / ")} — {v.sku}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <Button onClick={addLine} disabled={!selectedVariant}><Plus className="h-4 w-4" />Add</Button>
              </div>
            </div>

            {lines.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="py-2 text-left text-xs font-semibold text-text-muted">Product / Variant</th>
                  <th className="py-2 text-right text-xs font-semibold text-text-muted">Qty</th>
                  <th className="py-2 text-right text-xs font-semibold text-text-muted">Unit Cost (₦)</th>
                  <th className="py-2 text-right text-xs font-semibold text-text-muted">Total</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.variantId} className="border-b border-border">
                      <td className="py-2.5">
                        <p className="font-medium">{l.productName}</p>
                        <p className="text-xs text-text-muted">{l.variantLabel} · {l.sku}</p>
                      </td>
                      <td className="py-2.5 text-right">
                        <Input type="number" min={1} value={l.qty} className="w-16 text-right ml-auto"
                          onChange={e => setLines(prev => prev.map((x, j) => j === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x))} />
                      </td>
                      <td className="py-2.5 text-right">
                        <Input type="number" step="0.01" value={koboToNaira(l.unitCostKobo)} className="w-24 text-right ml-auto"
                          onChange={e => setLines(prev => prev.map((x, j) => j === i ? { ...x, unitCostKobo: nairaToKobo(parseFloat(e.target.value) || 0) } : x))} />
                      </td>
                      <td className="py-2.5 text-right font-medium">{formatMoney(l.qty * l.unitCostKobo)}</td>
                      <td className="py-2.5 pl-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} className="py-2.5 text-right font-semibold">Total</td>
                    <td className="py-2.5 text-right font-bold text-brand-purple">{formatMoney(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button disabled={!supplierId || lines.length === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating…" : "Create Purchase Order"}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
