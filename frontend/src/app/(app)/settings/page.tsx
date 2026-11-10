"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPut, getApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import type { BusinessSettings } from "@/types";

export default function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<BusinessSettings>>({});

  const { data: settings, isLoading } = useQuery<BusinessSettings>({
    queryKey: ["settings"],
    queryFn: () => apiGet<BusinessSettings>("/settings"),
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () => apiPut("/settings", form),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const f = <K extends keyof BusinessSettings>(key: K) => ({
    value: (form[key] ?? "") as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const numField = <K extends keyof BusinessSettings>(key: K) => ({
    value: (form[key] ?? 0) as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 })),
  });

  if (isLoading) return (
    <div>
      <PageHeader title="Settings" />
      <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure your shop settings"
        breadcrumbs={[{ label: "Settings" }]}
        actions={
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Save className="h-4 w-4" />{mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        }
      />

      <Tabs defaultValue="business" className="space-y-5">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        {/* Business Settings */}
        <TabsContent value="business">
          <Card>
            <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5"><Label>Shop Name</Label><Input {...f("shop_name")} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input {...f("phone")} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" {...f("email")} /></div>
              <div className="space-y-1.5"><Label>Timezone</Label><Input {...f("timezone")} /></div>
              <div className="space-y-1.5"><Label>Currency Code</Label><Input {...f("currency_code")} maxLength={3} /></div>
              <div className="space-y-1.5"><Label>Currency Symbol</Label><Input {...f("currency_symbol")} /></div>
              <div className="col-span-full space-y-1.5"><Label>Address</Label><Input {...f("address")} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Settings */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader><CardTitle>Inventory Configuration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label>Default Low Stock Threshold</Label>
                <Input type="number" min={0} {...numField("default_low_stock_threshold")} />
                <p className="text-xs text-text-muted">Products at or below this quantity are flagged as low stock.</p>
              </div>
              <div className="space-y-1.5">
                <Label>SKU Prefix</Label>
                <Input {...f("sku_prefix")} maxLength={10} />
              </div>
              <div className="flex items-center justify-between p-4 rounded-md border border-border col-span-full">
                <div>
                  <p className="font-medium text-sm">Auto-generate SKUs</p>
                  <p className="text-xs text-text-muted">Automatically create a SKU when adding a new product variant.</p>
                </div>
                <Switch
                  checked={!!form.sku_auto_generate}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, sku_auto_generate: v }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Settings */}
        <TabsContent value="sales">
          <Card>
            <CardHeader><CardTitle>Sales Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-md border border-border">
                <div>
                  <p className="font-medium text-sm">Allow Discounts</p>
                  <p className="text-xs text-text-muted">Permit attendants to apply discounts during checkout.</p>
                </div>
                <Switch
                  checked={!!form.allow_discount}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, allow_discount: v }))}
                />
              </div>

              {form.allow_discount && (
                <div className="space-y-1.5">
                  <Label>Maximum Discount %</Label>
                  <Input type="number" min={0} max={100} step={0.1} {...numField("max_discount_percent")} className="w-40" />
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-md border border-border">
                <div>
                  <p className="font-medium text-sm">Enable Tax</p>
                  <p className="text-xs text-text-muted">Apply tax to sales transactions.</p>
                </div>
                <Switch
                  checked={!!form.tax_enabled}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, tax_enabled: v }))}
                />
              </div>

              {form.tax_enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Tax Name</Label><Input {...f("tax_name")} /></div>
                  <div className="space-y-1.5"><Label>Tax Rate %</Label><Input type="number" min={0} max={100} step={0.1} {...numField("tax_percent")} /></div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Return Window (days)</Label>
                <Input type="number" min={0} {...numField("return_window_days")} className="w-40" />
                <p className="text-xs text-text-muted">Number of days after a sale that returns are accepted.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Receipt Footer Text</Label>
                <Input {...f("receipt_footer_text")} placeholder="e.g. Thank you for shopping with us!" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
