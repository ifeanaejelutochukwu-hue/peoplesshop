"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, getApiError, setAccessToken, setRefreshToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { LoginResponse } from "@/types";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const resp = await apiPost<LoginResponse>("/auth/login", data);
      // Hydrate in-memory tokens
      setAccessToken(resp.tokens.access_token);
      setRefreshToken(resp.tokens.refresh_token);
      // Store in auth state (persisted to sessionStorage)
      setAuth(resp.user, resp.tokens.access_token, resp.tokens.refresh_token, resp.permissions);
      toast.success(`Welcome back, ${resp.user.full_name}`);
      router.replace("/dashboard");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — branding panel */}
      <div className="hidden lg:flex w-1/2 bg-sidebar-bg flex-col justify-between p-12">
        <div>
          <Image
            src="/logo.png"
            alt="Peoplesshop"
            width={160}
            height={44}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>
        <div>
          <h2 className="text-3xl font-semibold text-white leading-tight">
            Your complete retail<br />management platform.
          </h2>
          <p className="mt-3 text-sidebar-text">
            Manage products, inventory, sales and more — all from one place.
          </p>
        </div>
        <div className="flex gap-6">
          {[
            { n: "Products", label: "Managed" },
            { n: "Sales", label: "Tracked" },
            { n: "Reports", label: "Generated" },
          ].map((s) => (
            <div key={s.n}>
              <p className="text-xs text-sidebar-text">{s.n}</p>
              <p className="text-sm font-medium text-white">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Image src="/logo.png" alt="Peoplesshop" width={140} height={38} className="h-9 w-auto" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-text-primary">Sign in</h1>
            <p className="mt-1 text-sm text-text-muted">
              Enter your credentials to access the platform
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="e.g. admin"
                {...register("username")}
                aria-invalid={!!errors.username}
              />
              {errors.username && (
                <p className="text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-text-muted">
            Peoplesshop Retail Management &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
