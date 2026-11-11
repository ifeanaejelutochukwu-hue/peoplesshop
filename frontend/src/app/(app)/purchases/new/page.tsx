"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { apiClient, apiPost, getApiError } from "@/lib/api";
import { formatMoney, nairaToKobo, koboToNaira } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Supplier, Product, Purchase, ApiResponse, Category } from "@/types";

interface LineItem {
  variantId: string;
  sku: string;
  productName: string;
  variantLabel: string;
  qty: number;
  unitCostKobo: number;
}

// ---- Quick-create supplier modal ----
function NewSupplierModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (supplier: Supplier) => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", contact_person: "" });
  const mutation = useMutation({
    mutationFn: () => apiPost<Supplier>("/suppliers", form),
    onSuccess: (s) => { toast.success("Supplier created"); onCreated(s); onClose(); setForm({ name: "", phone: "", email: "", contact_person: "" }); },
    onError: (err) => toast.error(getApiError(err)),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lagos Wholesale Textiles" /></div>
          <div className="space-y-1.5"><Label>Contact Person</Label><Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating…" : "Create Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Quick-create product + variant modal ----
function NewProductModal({ open, onClose, onCreated, categories }: {
  open: boolean;
  onClose: () => void;
  onCreated: (product: Product) => void;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"product" | "variant">("product");
  const [product, setProduct] = useState<Product | null>(null);
  const [pForm, setPForm] = useState({ name: "", brand: "", category_id: "" });
  const [vForm, setVForm] = useState({ size: "", colour: "", selling_price: "", cost_price: "", initial_stock: "0", low_stock_threshold: "5" });

  const productMutation = useMutation({
    mutationFn: () => apiPost<Product>("/products", {
      name: pForm.name,
      brand: pForm.brand || undefined,
      category_id: pForm.category_id ? parseInt(pForm.category_id) : undefined,
    }),
    onSuccess: (p) => { setProduct(p); setStep("variant"); },
    onError: (err) => toast.error(getApiError(err)),
  });

  const variantMutation = useMutation({
    mutationFn: () => apiPost(`/products/${product!.id}/variants`, {
      size: vForm.size || undefined,
      colour: vForm.colour || undefined,
      selling_price_kobo: nairaToKobo(parseFloat(vForm.selling_price) || 0),
      cost_price_kobo: nairaToKobo(parseFloat(vForm.cost_price) || 0),
      initial_stock: parseInt(vForm.initial_stock) || 0,
      low_stock_threshold: parseInt(vForm.low_stock_threshold) || 5,
    }),
    onSuccess: async () => {
      // Fetch the full product with variants
      const resp = await apiClient.get<ApiResponse<Product>>(`/products/${product!.id}`);
      const full = resp.data.data!;
      qc.invalidateQueries({ queryKey: ["products-for-purchase"] });
      toast.success("Product and variant created");
      onCreated(full);
      onClose();
      // Reset
      setStep("product");
      setProduct(null);
      setPForm({ name: "", brand: "", category_id: "" });
      setVForm({ size: "", colour: "", selling_price: "", cost_price: "", initial_stock: "0", low_stock_threshold: "5" });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "product" ? "New Product" : `Add Variant to "${product?.name}"`}</DialogTitle>
        </DialogHeader>

        {step === "product" ? (
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Product Name *</Label><Input value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Classic Polo Shirt" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Brand</Label><Input value={pForm.brand} onChange={e => setPForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Nike" /></div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={pForm.category_id} onValueChange={v => setPForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!pForm.name || productMutation.isPending} onClick={() => productMutation.mutate()}>
                {productMutation.isPending ? "Creating…" : "Next: Add Variant"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">Every product needs at least one variant (size/colour/price). You can add more from the product page later.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Size</Label><Input value={vForm.size} onChange={e => setVForm(f => ({ ...f, size: e.target.value }))} placeholder="e.g. M, L, XL, 42" /></div>
              <div className="space-y-1.5"><Label>Colour</Label><Input value={vForm.colour} onChange={e => setVForm(f => ({ ...f, colour: e.target.value }))} placeholder="e.g. Black, White" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Selling Price (₦) *</Label><Input type="number" step="0.01" value={vForm.selling_price} onChange={e => setVForm(f => ({ ...f, selling_price: e.target.value }))} placeholder="0.00" /></div>
              <div className="space-y-1.5"><Label>Cost Price (₦)</Label><Input type="number" step="0.01" value={vForm.cost_price} onChange={e => setVForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0.00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Opening Stock</Label><Input type="number" value={vForm.initial_stock} onChange={e => setVForm(f => ({ ...f, initial_stock: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Low Stock Alert</Label><Input type="number" value={vForm.low_stock_threshold} onChange={e => setVForm(f => ({ ...f, low_stock_threshold: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("product")}>Back</Button>
              <Button disabled={!vForm.selling_price || variantMutation.isPending} onClick={() => variantMutation.mutate()}>
                {variantMutation.isPending ? "Saving…" : "Create Product & Variant"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Page ----
export default function NewPurchasePage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [currentVariants, setCurrentVariants] = useState<Array<{ id: string; sku: string; size?: string; colour?: string; cost_price_kobo: number }>>([]);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>([]);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);

  // Load suppliers
  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-for-purchase"],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<Supplier[]>>("/suppliers", { params: { page: 1, page_size: 200 } });
      return resp.data.data ?? [];
    },
  });

  // Load products (list — no variants yet)
  const { data: productsData } = useQuery({
    queryKey: ["products-for-purchase"],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<Product[]>>("/products", { params: { page: 1, page_size: 200, is_active: true } });
      return resp.data.data ?? [];
    },
  });

  // Load categories for the new product modal
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const resp = await apiClient.get<ApiResponse<Category[]>>("/categories");
      return resp.data.data ?? [];
    },
  });

  const allSuppliers = [...(suppliersData ?? []), ...localSuppliers];
  const allProducts = [...(productsData ?? []), ...localProducts];

  // When a product is selected, fetch its variants
  const handleProductSelect = async (productId: string) => {
    setSelectedProduct(productId);
    setSelectedVariant("");
    setCurrentVariants([]);
    if (!productId) return;
    setLoadingVariants(true);
    try {
      const resp = await apiClient.get<ApiResponse<Product>>(`/products/${productId}`);
      const product = resp.data.data;
      if (product?.variants) {
        setCurrentVariants(product.variants.map(v => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          colour: v.colour,
          cost_price_kobo: v.cost_price_kobo,
        })));
      }
    } catch {
      toast.error("Could not load variants");
    } finally {
      setLoadingVariants(false);
    }
  };

  const addLine = () => {
    if (!selectedVariant) return;
    const variant = currentVariants.find(v => v.id === selectedVariant);
    const product = allProducts.find(p => p.id === selectedProduct);
    if (!variant || !product) return;
    if (lines.find(l => l.variantId === selectedVariant)) {
      toast.error("This variant is already in the order");
      return;
    }
    setLines(prev => [...prev, {
      variantId: variant.id,
      sku: variant.sku,
      productName: product.name,
      variantLabel: [variant.size, variant.colour].filter(Boolean).join(" / ") || "Default",
      qty: 1,
      unitCostKobo: variant.cost_price_kobo || 0,
    }]);
    setSelectedVariant("");
  };

  const total = lines.reduce((s, l) => s + l.qty * l.unitCostKobo, 0);

  const mutation = useMutation({
    mutationFn: () => apiPost<Purchase>("/purchases", {
      supplier_id: supplierId,
      purchase_date: purchaseDate,
      expected_delivery: expectedDelivery || undefined,
      notes: notes || undefined,
      items: lines.map(l => ({ variant_id: l.variantId, quantity: l.qty, unit_cost_kobo: l.unitCostKobo })),
    }),
    onSuccess: (p) => { toast.success("Purchase order created"); router.push(`/purchases/${p.id}`); },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <div>
      <PageHeader
        title="New Purchase Order"
        breadcrumbs={[{ label: "Purchases", href: "/purchases" }, { label: "New" }]}
      />

      <div className="max-w-3xl space-y-5">
        {/* Order Details */}
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Supplier *</Label>
                  <button onClick={() => setShowNewSupplier(true)} className="text-xs text-brand-purple hover:underline flex items-center gap-0.5">
                    <Plus className="h-3 w-3" />New supplier
                  </button>
                </div>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    {allSuppliers.length === 0 && (
                      <div className="px-3 py-2 text-xs text-text-muted">No suppliers yet — click "New supplier" above</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Expected Delivery <span className="text-text-muted text-xs">(optional)</span></Label>
                <Input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Notes <span className="text-text-muted text-xs">(optional)</span></Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this order…" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Items</CardTitle>
              <button onClick={() => setShowNewProduct(true)} className="text-xs text-brand-purple hover:underline flex items-center gap-0.5">
                <Plus className="h-3 w-3" />New product
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product + Variant selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Select value={selectedProduct} onValueChange={handleProductSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {allProducts.length === 0 && (
                      <div className="px-3 py-2 text-xs text-text-muted">No products — click "New product" above</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Variant {loadingVariants && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
                </Label>
                <Select
                  value={selectedVariant}
                  onValueChange={setSelectedVariant}
                  disabled={!selectedProduct || loadingVariants}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingVariants ? "Loading…" : "Select variant"} />
                  </SelectTrigger>
                  <SelectContent>
                    {currentVariants.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {[v.size, v.colour].filter(Boolean).join(" / ") || "Default"} — {v.sku}
                      </SelectItem>
                    ))}
                    {selectedProduct && !loadingVariants && currentVariants.length === 0 && (
                      <div className="px-3 py-2 text-xs text-text-muted">No variants — go to the product page to add variants first</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={addLine}
                disabled={!selectedVariant || loadingVariants}
                className="w-full"
              >
                <Plus className="h-4 w-4" />Add to Order
              </Button>
            </div>

            {/* Line items table */}
            {lines.length > 0 ? (
              <div className="mt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 text-left text-xs font-semibold text-text-muted uppercase">Product / Variant</th>
                      <th className="py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Qty</th>
                      <th className="py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Unit Cost (₦)</th>
                      <th className="py-2.5 text-right text-xs font-semibold text-text-muted uppercase">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.variantId} className="border-b border-border">
                        <td className="py-3">
                          <p className="font-medium">{l.productName}</p>
                          <p className="text-xs text-text-muted">{l.variantLabel} · <span className="font-mono">{l.sku}</span></p>
                        </td>
                        <td className="py-3 text-right">
                          <Input
                            type="number"
                            min={1}
                            value={l.qty}
                            className="w-16 text-right ml-auto h-8"
                            onChange={e => setLines(prev => prev.map((x, j) => j === i ? { ...x, qty: Math.max(1, parseInt(e.target.value) || 1) } : x))}
                          />
                        </td>
                        <td className="py-3 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={koboToNaira(l.unitCostKobo) || ""}
                            placeholder="0.00"
                            className="w-28 text-right ml-auto h-8"
                            onChange={e => setLines(prev => prev.map((x, j) => j === i ? { ...x, unitCostKobo: nairaToKobo(parseFloat(e.target.value) || 0) } : x))}
                          />
                        </td>
                        <td className="py-3 text-right font-medium tabular-nums">
                          {formatMoney(l.qty * l.unitCostKobo)}
                        </td>
                        <td className="py-3 pl-2">
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600"
                            onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td colSpan={3} className="py-3 text-right font-semibold text-text-primary">Order Total</td>
                      <td className="py-3 text-right font-bold text-lg text-brand-purple tabular-nums">{formatMoney(total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-text-muted">
                <p className="text-sm">No items added yet</p>
                <p className="text-xs mt-1">Select a product and variant above, then click "Add to Order"</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <Button
            disabled={!supplierId || lines.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
            size="lg"
          >
            {mutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
            ) : (
              "Create Purchase Order"
            )}
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>

      {/* Modals */}
      <NewSupplierModal
        open={showNewSupplier}
        onClose={() => setShowNewSupplier(false)}
        onCreated={(s) => { setLocalSuppliers(prev => [...prev, s]); setSupplierId(s.id); }}
      />

      <NewProductModal
        open={showNewProduct}
        onClose={() => setShowNewProduct(false)}
        categories={categories ?? []}
        onCreated={(p) => {
          setLocalProducts(prev => [...prev, p]);
          setSelectedProduct(p.id);
          if (p.variants) {
            setCurrentVariants(p.variants.map(v => ({
              id: v.id, sku: v.sku,
              size: v.size, colour: v.colour,
              cost_price_kobo: v.cost_price_kobo,
            })));
          }
        }}
      />
    </div>
  );
}
