"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, CreditCard, ArrowLeft,
  Package, Settings, Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Organizations", href: "/admin/organizations", icon: Building2 },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Plans", href: "/admin/plans", icon: CreditCard },
  { title: "Referrals", href: "/admin/referrals", icon: Gift },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-800 bg-gray-950">
      {/* Header */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-800 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white font-bold text-sm">
          P
        </div>
        <div>
          <span className="text-lg font-bold text-white">Proviant</span>
          <span className="ml-2 rounded bg-red-600/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
            Admin
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                  )}
                >
                  <Icon size={20} />
                  <span>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Back to app */}
      <div className="border-t border-gray-800 p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-900 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
