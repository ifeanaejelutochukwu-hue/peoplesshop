"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiPost, apiGet, getApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category, Product } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  brand: z.string().optional(),
  category_id: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function NewProductPage() {
  const router = useRouter();
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/categories"),
  });

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      apiPost<Product>("/products", {
        ...data,
        category_id: data.category_id ? parseInt(data.category_id) : undefined,
      }),
    onSuccess: (product) => {
      toast.success("Product created — now add variants");
      router.push(`/products/${product.id}`);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <div>
      <PageHeader
        title="New Product"
        breadcrumbs={[{ label: "Products", href: "/products" }, { label: "New" }]}
      />
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="name">Product Name *</Label>
                <Input id="name" placeholder="e.g. Classic Polo Shirt" {...register("name")} />
                {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} placeholder="Brief product description…" {...register("description")} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" placeholder="e.g. Nike, Zara" {...register("brand")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select onValueChange={(v) => setValue("category_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create Product"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              </div>

              <p className="text-xs text-text-muted">
                After creating the product, you will be taken to the product page where you can add sizes, colours and prices.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
