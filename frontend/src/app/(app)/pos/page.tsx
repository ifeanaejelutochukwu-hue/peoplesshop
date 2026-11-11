"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, ShoppingCart, Plus, Minus, X, CreditCard, Loader2, Package, Printer } from "lucide-react";
import { toast } from "sonner";

import { apiClient, apiGet, getApiError } from "@/lib/api";
import { formatMoney, nairaToKobo, koboToNaira } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Product, ProductVariant, Category, ApiResponse, CartItem, CartPayment } from "@/types";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "pos_card", label: "POS/Card" },
  { value: "other", label: "Other" },
];

export default function POSPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payments, setPayments] = useState<CartPayment[]>([{ method: "cash", amount_kobo: 0 }]);
  const [receiptData, setReceiptData] = useState<{ reference: string; total: number } | null>(null);
  const [variantSelectProduct, setVariantSelectProduct] = useState<Product | null>(null);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/categories"),
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["pos-products", search, categoryFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page: 1, page_size: 40, is_active: true };
      if (search) params.search = search;
      if (categoryFilter) params.category_id = parseInt(categoryFilter);
      const resp = await apiClient.get<ApiResponse<Product[]>>("/products", { params });
      return resp.data.data ?? [];
    },
  });

  const products = productsData ?? [];

  // ---- Cart operations ----
  const addToCart = useCallback((variant: ProductVariant, product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.variant.id === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock_quantity) {
          toast.error(`Only ${variant.stock_quantity} in stock`);
          return prev;
        }
        return prev.map((i) => i.variant.id === variant.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
        );
      }
      if (variant.stock_quantity === 0) {
        toast.error("This item is out of stock");
        return prev;
      }
      return [...prev, {
        variant,
        product,
        quantity: 1,
        unit_price_kobo: variant.selling_price_kobo,
        discount_kobo: 0,
      }];
    });
  }, []);

  const removeFromCart = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variant.id !== variantId));
  }, []);

  const updateQty = useCallback((variantId: string, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.variant.id !== variantId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (newQty > i.variant.stock_quantity) {
        toast.error(`Only ${i.variant.stock_quantity} available`);
        return i;
      }
      return { ...i, quantity: newQty };
    }));
  }, []);

  const cartSubtotal = cart.reduce((s, i) => s + i.unit_price_kobo * i.quantity - i.discount_kobo, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount_kobo, 0);
  const change = totalPaid - cartSubtotal;

  // ---- Checkout ----
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiClient.post<ApiResponse<{ id: string; reference: string; total_kobo: number }>>("/sales", {
        items: cart.map((i) => ({
          variant_id: i.variant.id,
          quantity: i.quantity,
          discount_kobo: i.discount_kobo,
        })),
        payments: payments.filter((p) => p.amount_kobo > 0).map((p) => ({
          method: p.method,
          amount_kobo: p.amount_kobo,
          reference: p.reference ?? "",
        })),
      });
      if (!resp.data.success || !resp.data.data) throw new Error(resp.data.error?.message ?? "Sale failed");
      return resp.data.data;
    },
    onSuccess: (data) => {
      setReceiptData({ reference: data.reference, total: data.total_kobo });
      setCart([]);
      setPayments([{ method: "cash", amount_kobo: 0 }]);
      setCheckoutOpen(false);
      toast.success(`Sale ${data.reference} completed`);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const [loadingVariantsFor, setLoadingVariantsFor] = useState<string | null>(null);

  const handleProductClick = async (product: Product) => {
    // Fetch full product with variants on click
    setLoadingVariantsFor(product.id);
    try {
      const resp = await apiClient.get<ApiResponse<Product>>(`/products/${product.id}`);
      const fullProduct = resp.data.data;
      if (!fullProduct || !fullProduct.variants || fullProduct.variants.length === 0) {
        toast.error("This product has no variants configured yet");
        return;
      }
      if (fullProduct.variants.length === 1) {
        addToCart(fullProduct.variants[0], fullProduct);
      } else {
        setVariantSelectProduct(fullProduct);
      }
    } catch {
      toast.error("Could not load product details");
    } finally {
      setLoadingVariantsFor(null);
    }
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    setPayments([{ method: "cash", amount_kobo: cartSubtotal }]);
    setCheckoutOpen(true);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-[calc(100vh-24px)] -mt-4 lg:-mt-6 -mx-5 lg:-mx-6">
      {/* ---- Product Panel ---- */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        {/* Search bar */}
        <div className="p-3 border-b border-border bg-white flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <Input
              placeholder="Search product or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <Package className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((product) => {
                const inStock = (product.total_stock_units ?? 0) > 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    disabled={!inStock || loadingVariantsFor === product.id}
                    className="group text-left rounded-lg border border-border bg-white p-3 transition-all hover:border-brand-purple hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="h-16 w-full rounded-md bg-background flex items-center justify-center mb-2 overflow-hidden">
                      {loadingVariantsFor === product.id ? (
                        <Loader2 className="h-6 w-6 text-brand-purple animate-spin" />
                      ) : product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-gray-300" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-text-primary line-clamp-2 leading-tight">{product.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">{product.variants?.length ?? 0} variant{product.variants?.length !== 1 ? "s" : ""}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-brand-purple">
                        {product.variants && product.variants.length > 0
                          ? formatMoney(Math.min(...product.variants.map((v) => v.selling_price_kobo)))
                          : "—"}
                      </span>
                      <span className={`text-xs ${inStock ? "text-green-600" : "text-red-500"}`}>
                        {inStock ? `${product.total_stock_units} left` : "Out of stock"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---- Cart Panel ---- */}
      <div className="w-80 xl:w-96 flex flex-col bg-white">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-brand-purple" />
            <span className="font-semibold text-sm">Cart</span>
            {cart.length > 0 && (
              <Badge className="bg-brand-purple text-white text-xs px-1.5 py-0">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-600">Clear</button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <ShoppingCart className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-0.5">Click a product to add it</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.variant.id} className="flex gap-2 p-2.5 rounded-md border border-border bg-background">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.name}</p>
                  <p className="text-xs text-text-muted">
                    {[item.variant.size, item.variant.colour].filter(Boolean).join(" / ")} · {item.variant.sku}
                  </p>
                  <p className="text-sm font-semibold text-brand-purple mt-1">
                    {formatMoney(item.unit_price_kobo * item.quantity)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button onClick={() => removeFromCart(item.variant.id)} className="text-text-muted hover:text-red-500 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.variant.id, -1)} className="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-background">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQty(item.variant.id, 1)} className="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-background">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart footer */}
        <div className="border-t border-border p-3 space-y-3">
          <div className="flex justify-between text-sm font-semibold text-text-primary">
            <span>Total</span>
            <span className="text-lg">{formatMoney(cartSubtotal)}</span>
          </div>
          <Button
            className="w-full"
            onClick={openCheckout}
            disabled={cart.length === 0}
          >
            <CreditCard className="h-4 w-4" />
            Charge {cart.length > 0 ? formatMoney(cartSubtotal) : ""}
          </Button>
        </div>
      </div>

      {/* ---- Variant Selection Modal ---- */}
      <Dialog open={!!variantSelectProduct} onOpenChange={(o) => !o && setVariantSelectProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{variantSelectProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {variantSelectProduct?.variants?.map((v) => (
              <button
                key={v.id}
                disabled={v.stock_quantity === 0}
                onClick={() => { addToCart(v, variantSelectProduct!); setVariantSelectProduct(null); }}
                className="w-full flex items-center justify-between p-3 rounded-md border border-border hover:border-brand-purple hover:bg-brand-purple-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="text-left">
                  <p className="text-sm font-medium">{[v.size, v.colour].filter(Boolean).join(" / ") || "Default"}</p>
                  <p className="text-xs text-text-muted font-mono">{v.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-brand-purple">{formatMoney(v.selling_price_kobo)}</p>
                  <p className={`text-xs ${v.stock_quantity > 0 ? "text-green-600" : "text-red-500"}`}>
                    {v.stock_quantity > 0 ? `${v.stock_quantity} available` : "Out of stock"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Checkout Modal ---- */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Sale</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Order summary */}
            <div className="rounded-md border border-border p-3 space-y-1.5 max-h-40 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.variant.id} className="flex justify-between text-sm">
                  <span className="truncate max-w-[200px]">
                    {item.product.name} · {[item.variant.size, item.variant.colour].filter(Boolean).join("/")} × {item.quantity}
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(item.unit_price_kobo * item.quantity)}</span>
                </div>
              ))}
            </div>

            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-lg text-brand-purple">{formatMoney(cartSubtotal)}</span>
            </div>

            {/* Payments */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Payment</Label>
              {payments.map((p, idx) => (
                <div key={idx} className="flex gap-2">
                  <Select value={p.method} onValueChange={(v) => setPayments((ps) => ps.map((pm, i) => i === idx ? { ...pm, method: v } : pm))}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={koboToNaira(p.amount_kobo) || ""}
                    onChange={(e) => setPayments((ps) => ps.map((pm, i) =>
                      i === idx ? { ...pm, amount_kobo: nairaToKobo(parseFloat(e.target.value) || 0) } : pm
                    ))}
                    className="flex-1"
                  />
                  {payments.length > 1 && (
                    <button onClick={() => setPayments((ps) => ps.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setPayments((ps) => [...ps, { method: "bank_transfer", amount_kobo: 0 }])}
                className="text-xs text-brand-purple hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add payment method
              </button>
            </div>

            {/* Change */}
            {change > 0 && (
              <div className="flex justify-between text-sm bg-green-50 border border-green-200 rounded-md p-2">
                <span className="text-green-700 font-medium">Change</span>
                <span className="text-green-700 font-semibold">{formatMoney(change)}</span>
              </div>
            )}
            {change < 0 && (
              <div className="flex justify-between text-sm bg-amber-50 border border-amber-200 rounded-md p-2">
                <span className="text-amber-700 font-medium">Outstanding</span>
                <span className="text-amber-700 font-semibold">{formatMoney(-change)}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending || totalPaid <= 0}
            >
              {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Complete Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Receipt confirmation ---- */}
      {receiptData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-xs w-full text-center shadow-xl">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary">Sale Complete</h3>
            <p className="text-text-muted text-sm mt-1">Ref: {receiptData.reference}</p>
            <p className="text-2xl font-bold text-brand-purple mt-2">{formatMoney(receiptData.total)}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReceiptData(null)}>
                Close
              </Button>
              <Button className="flex-1" onClick={() => { window.print(); setReceiptData(null); }}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
