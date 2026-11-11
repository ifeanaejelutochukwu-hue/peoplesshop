import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import type { ApiResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://peoplesshop.onrender.com/api/v1";

// ---- Token management ----
// Tokens are kept in memory (not localStorage) to avoid XSS exposure.
// The refresh token is also kept in memory since we're a SPA.

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// ---- Axios instance ----

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Handle 401 — attempt token refresh
let refreshPromise: Promise<void> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // If a refresh is already in flight, wait for it
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      try {
        await refreshPromise;
        // Retry original request with new token
        if (original.headers) {
          original.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(original);
      } catch {
        // Refresh failed — clear auth state
        setAccessToken(null);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ---- Refresh logic ----

let storedRefreshToken: string | null = null;

export const setRefreshToken = (token: string | null) => {
  storedRefreshToken = token;
};

async function refreshAccessToken(): Promise<void> {
  if (!storedRefreshToken) throw new Error("No refresh token");

  const resp = await axios.post<ApiResponse<{ access_token: string; refresh_token: string }>>(
    `${API_URL}/auth/refresh`,
    { refresh_token: storedRefreshToken }
  );

  if (resp.data.success && resp.data.data) {
    setAccessToken(resp.data.data.access_token);
    setRefreshToken(resp.data.data.refresh_token);
  } else {
    throw new Error("Refresh failed");
  }
}

// ---- Typed API helpers ----

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const resp = await apiClient.get<ApiResponse<T>>(url, { params });
  if (!resp.data.success || resp.data.data === undefined) {
    throw new Error(resp.data.error?.message || "Request failed");
  }
  return resp.data.data;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const resp = await apiClient.post<ApiResponse<T>>(url, data);
  if (!resp.data.success || resp.data.data === undefined) {
    throw new Error(resp.data.error?.message || "Request failed");
  }
  return resp.data.data;
}

export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  const resp = await apiClient.put<ApiResponse<T>>(url, data);
  if (!resp.data.success || resp.data.data === undefined) {
    throw new Error(resp.data.error?.message || "Request failed");
  }
  return resp.data.data;
}

export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  const resp = await apiClient.patch<ApiResponse<T>>(url, data);
  if (!resp.data.success || resp.data.data === undefined) {
    throw new Error(resp.data.error?.message || "Request failed");
  }
  return resp.data.data;
}

export async function apiDelete<T = { message: string }>(url: string): Promise<T> {
  const resp = await apiClient.delete<ApiResponse<T>>(url);
  if (!resp.data.success || resp.data.data === undefined) {
    throw new Error(resp.data.error?.message || "Request failed");
  }
  return resp.data.data;
}

// ---- Error extraction ----

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown>;
    return data?.error?.message || error.message || "An unexpected error occurred";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown>;
    return data?.error?.fields || {};
  }
  return {};
}
