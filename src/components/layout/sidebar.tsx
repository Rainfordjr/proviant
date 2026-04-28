"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Wheat, ShoppingBag, ShieldCheck,
  Warehouse, Truck, Settings, ChevronDown, Menu, X,
  List, Plus, ClipboardCheck, FileText, BarChart3, Receipt, BarChart, ChefHat, FlaskConical,
  Shield, Users, Store, MapPin, CreditCard, DollarSign, Building2, ClipboardList,
  CalendarDays, CheckCircle2, Palette, Wallet,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { APP_NAME, SIDEBAR_NAV, NavItem, NavChild } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Package, Wheat, ShoppingBag, ShieldCheck,
  Warehouse, Truck, Settings, List, Plus, ClipboardCheck,
  FileText, BarChart3, Receipt, BarChart, ChefHat, FlaskConical,
  Shield, Users, Store, MapPin, CreditCard, DollarSign, Building2, ClipboardList,
  CalendarDays, CheckCircle2, Palette, Wallet,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [flyout, setFlyout] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Close flyout when clicking outside
  useEffect(() => {
    if (!flyout) return;
    const handleClick = (e: MouseEvent) => {
      if (
        flyoutRef.current && !flyoutRef.current.contains(e.target as Node) &&
        sidebarRef.current && !sidebarRef.current.contains(e.target as Node)
      ) {
        setFlyout(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [flyout]);

  // Close flyout when navigating
  useEffect(() => { setFlyout(null); }, [pathname]);
  const [userPerms, setUserPerms] = useState<Set<string> | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeModules, setActiveModules] = useState<Set<string> | null>(null);

  // Load the current user's permissions and active modules once on mount
  useEffect(() => {
    async function loadPermissionsAndModules() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Fetch the user's org_id
      const { data: profile } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user.id)
        .single();

      // Fetch active modules for this org + core modules (always active)
      if (profile?.org_id) {
        const { data: orgModules } = await supabase
          .from("org_modules")
          .select("modules!inner(slug)")
          .eq("org_id", profile.org_id)
          .eq("is_active", true);

        const { data: coreModules } = await supabase
          .from("modules")
          .select("slug")
          .eq("is_core", true);

        const slugs = new Set<string>();
        if (orgModules) {
          for (const om of orgModules) {
            const mod = (om as any).modules;
            if (mod?.slug) slugs.add(mod.slug);
          }
        }
        if (coreModules) {
          for (const cm of coreModules) {
            if (cm.slug) slugs.add(cm.slug);
          }
        }
        setActiveModules(slugs);
      } else {
        setActiveModules(new Set());
      }

      // Check if user has an admin role
      const { data: adminCheck } = await supabase
        .from("user_roles")
        .select("roles!inner(is_admin)")
        .eq("user_id", user.id)
        .eq("roles.is_admin", true)
        .limit(1);

      const admin = !!(adminCheck && adminCheck.length > 0);
      setIsAdmin(admin);

      if (admin) {
        // Admins see everything — no need to check individual permissions
        setUserPerms(new Set(["__admin__"]));
        return;
      }

      // For non-admins, fetch their granted permission codes
      const { data: grants } = await supabase
        .from("user_roles")
        .select("roles!inner(role_permissions(permissions(code)))")
        .eq("user_id", user.id);

      const codes = new Set<string>();
      if (grants) {
        for (const ur of grants) {
          const role = (ur as any).roles;
          if (role?.role_permissions) {
            for (const rp of role.role_permissions) {
              if (rp.permissions?.code) {
                codes.add(rp.permissions.code);
              }
            }
          }
        }
      }
      setUserPerms(codes);
    }

    loadPermissionsAndModules();
  }, []);

  const toggleSection = (title: string) => {
    setOpenSections((prev) =>
      prev.includes(title) ? [] : [title]
    );
  };

  // Permission check helpers
  function hasPermission(code: string): boolean {
    if (!userPerms) return false;
    if (isAdmin) return true;
    return userPerms.has(code);
  }

  function isChildVisible(child: NavChild): boolean {
    if (child.requireAdmin && !isAdmin) return false;
    if (child.permission && !hasPermission(child.permission)) return false;
    return true;
  }

  function isModuleActive(slug: string): boolean {
    if (!activeModules) return false;
    return activeModules.has(slug);
  }

  function isItemVisible(item: NavItem): boolean {
    // If the item is tied to a module, check that the module is active
    if (item.moduleSlug && !isModuleActive(item.moduleSlug)) return false;

    // Dashboard and items without permission requirements are always visible
    if (!item.permission && !item.requireAdmin) {
      // But if all children require permissions and none are visible, hide the section
      if (item.children && item.children.length > 0) {
        const visibleChildren = item.children.filter(isChildVisible);
        return visibleChildren.length > 0;
      }
      return true;
    }
    if (item.requireAdmin && !isAdmin) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  }

  // Don't render nav items until permissions and modules are loaded (avoid flash of full nav)
  const navReady = userPerms !== null && activeModules !== null;

  // Open a flyout popover positioned next to the clicked icon
  const openFlyout = (title: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyoutTop(rect.top);
    setFlyout((prev) => (prev === title ? null : title));
  };

  // Find the flyout item's visible children for the popover
  const flyoutItem = flyout
    ? SIDEBAR_NAV.find((i) => i.title === flyout)
    : null;
  const flyoutChildren = flyoutItem
    ? (flyoutItem.children || []).filter(isChildVisible)
    : [];

  return (
    <>
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-gray-200 bg-white transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
                P
              </div>
              <span className="text-lg font-bold text-gray-900">{APP_NAME}</span>
            </Link>
          )}
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navReady &&
              SIDEBAR_NAV.filter(isItemVisible).map((item) => {
                const Icon = iconMap[item.icon] || LayoutDashboard;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                const isOpen = openSections.includes(item.title);
                const visibleChildren = (item.children || []).filter(isChildVisible);
                const hasChildren = visibleChildren.length > 0;

                return (
                  <li key={item.title}>
                    {hasChildren ? (
                      <>
                        <button
                          onClick={(e) =>
                            collapsed ? openFlyout(item.title, e) : toggleSection(item.title)
                          }
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700 hover:bg-gray-100",
                            collapsed && "justify-center"
                          )}
                          title={collapsed ? item.title : undefined}
                        >
                          <Icon size={20} />
                          {!collapsed && (
                            <>
                              <span className="flex-1 text-left">{item.title}</span>
                              <ChevronDown
                                size={16}
                                className={cn(
                                  "transition-transform",
                                  isOpen && "rotate-180"
                                )}
                              />
                            </>
                          )}
                        </button>
                        {!collapsed && isOpen && (
                          <ul className="ml-6 mt-1 space-y-1 border-l border-gray-200 pl-3">
                            {visibleChildren.map((child) => {
                              const ChildIcon = iconMap[child.icon] || List;
                              const isChildActive = pathname === child.href;
                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                                      isChildActive
                                        ? "bg-blue-50 text-blue-700 font-medium"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    )}
                                  >
                                    <ChildIcon size={16} />
                                    <span>{child.title}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-100",
                          collapsed && "justify-center"
                        )}
                        title={collapsed ? item.title : undefined}
                      >
                        <Icon size={20} />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    )}
                  </li>
                );
              })}
            {!navReady && (
              <li className="px-3 py-2 text-xs text-gray-400">Loading…</li>
            )}
          </ul>
        </nav>
      </aside>

      {/* Flyout popover for collapsed sidebar */}
      {collapsed && flyout && flyoutChildren.length > 0 && (
        <div
          ref={flyoutRef}
          className="fixed z-50 ml-16 w-48 rounded-lg border border-gray-200 bg-white py-2 shadow-lg animate-in fade-in slide-in-from-left-2 duration-150"
          style={{ top: flyoutTop }}
        >
          <div className="px-3 py-1.5 text-xs font-semibold uppercase text-gray-400 tracking-wider">
            {flyout}
          </div>
          {flyoutChildren.map((child) => {
            const ChildIcon = iconMap[child.icon] || List;
            const isChildActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                  isChildActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <ChildIcon size={16} />
                <span>{child.title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
