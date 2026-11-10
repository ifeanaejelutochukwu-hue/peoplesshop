"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { setAccessToken, setRefreshToken } from "@/lib/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, refreshToken } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    // Re-hydrate in-memory tokens from sessionStorage on page reload
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
  }, [isAuthenticated, router, refreshToken]);

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="page-container min-h-full pt-4 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
