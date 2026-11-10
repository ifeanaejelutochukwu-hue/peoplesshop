import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---- Money formatting ----
// All amounts from the API are in kobo (integer minor units)
// 100 kobo = ₦1.00

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function formatMoney(kobo: number, symbol = "₦"): string {
  const naira = koboToNaira(kobo);
  return `${symbol}${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoneyInput(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

// ---- Date formatting ----

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy");
  } catch {
    return "—";
  }
}

export function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, hh:mm a");
  } catch {
    return "—";
  }
}

export function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

// ---- Stock status ----

export function getStockStatusLabel(status: string): string {
  switch (status) {
    case "in_stock": return "In Stock";
    case "low_stock": return "Low Stock";
    case "out_of_stock": return "Out of Stock";
    default: return status;
  }
}

export function getStockStatusColor(status: string): string {
  switch (status) {
    case "in_stock": return "text-green-700 bg-green-50 border-green-200";
    case "low_stock": return "text-amber-700 bg-amber-50 border-amber-200";
    case "out_of_stock": return "text-red-700 bg-red-50 border-red-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

// ---- Payment status ----

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case "paid": return "text-green-700 bg-green-50 border-green-200";
    case "partial": return "text-amber-700 bg-amber-50 border-amber-200";
    case "unpaid": return "text-red-700 bg-red-50 border-red-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

// ---- General ----

export function truncate(str: string, maxLen = 40): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

export function generateInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? singular + "s"}`;
}
