"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import {
  LayoutDashboard,
  Package,
  Tag,
  Layers,
  ShoppingCart,
  Truck,
  CreditCard,
  RotateCcw,
  Users,
  Receipt,
  BarChart2,
  Settings,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  UserCog,
  Store,
} from "lucide-react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  permission?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    label: "Point of Sale",
    href: "/pos",
    icon: Store,
    permission: "pos:access",
  },
  {
    label: "Products",
    icon: Package,
    permission: "products:view",
    children: [
      { label: "All Products", href: "/products", icon: Package },
      { label: "Categories", href: "/categories", icon: Tag },
    ],
  },
  {
    label: "Inventory",
    icon: Layers,
    permission: "inventory:view",
    children: [
      { label: "Overview", href: "/inventory", icon: Layers },
      { label: "Movements", href: "/inventory/movements", icon: ClipboardList },
      { label: "Adjustments", href: "/inventory/adjustments", icon: ClipboardList },
    ],
  },
  {
    label: "Purchases",
    icon: ShoppingCart,
    permission: "purchases:view",
    children: [
      { label: "All Purchases", href: "/purchases", icon: ShoppingCart },
      { label: "Suppliers", href: "/suppliers", icon: Truck },
    ],
  },
  {
    label: "Sales",
    href: "/sales",
    icon: CreditCard,
    permission: "sales:view",
  },
  {
    label: "Returns",
    href: "/returns",
    icon: RotateCcw,
    permission: "returns:view",
  },
  {
    label: "Customers",
    href: "/customers",
    icon: Users,
    permission: "customers:view",
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: Receipt,
    permission: "expenses:view",
  },
  {
    label: "Reports",
    icon: BarChart2,
    permission: "reports:sales",
    children: [
      { label: "Sales", href: "/reports/sales", icon: BarChart2 },
      { label: "Inventory", href: "/reports/inventory", icon: BarChart2 },
      { label: "Profit", href: "/reports/profit", icon: BarChart2 },
      { label: "Products", href: "/reports/products", icon: BarChart2 },
    ],
  },
  {
    label: "Staff",
    href: "/staff",
    icon: UserCog,
    permission: "staff:view",
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    icon: ClipboardList,
    permission: "audit:view",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "settings:view",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission, user, clearAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(["Products", "Inventory", "Purchases", "Reports"]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const isGroupActive = (item: NavItem) =>
    item.children?.some((c) => c.href && isActive(c.href));

  const handleLogout = async () => {
    clearAuth();
    window.location.href = "/login";
  };

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-active">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Peoplesshop"
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          if (item.children) {
            const open = openGroups.includes(item.label);
            const groupActive = isGroupActive(item);
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    groupActive
                      ? "text-white"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                      )}
                    </>
                  )}
                </button>
                {open && !collapsed && (
                  <div className="mt-0.5 ml-4 pl-3 border-l border-sidebar-active space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href!}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                          child.href && isActive(child.href)
                            ? "bg-sidebar-active text-white font-medium"
                            : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive(item.href!)
                  ? "bg-sidebar-active text-white font-medium"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-active p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-brand-purple flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {user?.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-sidebar-text capitalize">{user?.role.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sidebar-text hover:text-white transition-colors"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center text-sidebar-text hover:text-white transition-colors py-1"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar-bg transition-all duration-200 h-screen sticky top-0 flex-shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 h-9 w-9 flex items-center justify-center rounded-md bg-sidebar-bg text-white shadow"
        >
          <Menu className="h-5 w-5" />
        </button>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed left-0 top-0 z-50 h-screen w-60 bg-sidebar-bg flex flex-col">
              <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-active">
                <Image src="/logo.png" alt="Peoplesshop" width={120} height={32} className="h-8 w-auto object-contain" />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-sidebar-text hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent />
            </aside>
          </>
        )}
      </div>
    </>
  );
}
