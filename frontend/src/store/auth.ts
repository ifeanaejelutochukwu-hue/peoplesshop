import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/types";
import { setAccessToken, setRefreshToken } from "@/lib/api";

interface AuthState {
  user: User | null;
  permissions: string[];
  refreshToken: string | null;
  isAuthenticated: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string, permissions: string[]) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      permissions: [],
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken, permissions) => {
        setAccessToken(accessToken);
        setRefreshToken(refreshToken);
        set({
          user,
          permissions,
          refreshToken,
          isAuthenticated: true,
        });
      },

      clearAuth: () => {
        setAccessToken(null);
        setRefreshToken(null);
        set({
          user: null,
          permissions: [],
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      hasPermission: (permission) => {
        const { permissions, user } = get();
        if (user?.role.name === "owner") return true;
        return permissions.includes(permission);
      },

      hasAnyPermission: (...perms) => {
        const { permissions, user } = get();
        if (user?.role.name === "owner") return true;
        return perms.some((p) => permissions.includes(p));
      },
    }),
    {
      name: "peoplesshop-auth",
      storage: createJSONStorage(() => sessionStorage),
      // Only persist non-sensitive data; tokens are in memory via setAccessToken
      partialize: (state) => ({
        user: state.user,
        permissions: state.permissions,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      // Rehydrate tokens into memory after page reload
      onRehydrateStorage: () => (state) => {
        if (state?.refreshToken) {
          setRefreshToken(state.refreshToken);
        }
      },
    }
  )
);
