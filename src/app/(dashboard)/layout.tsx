"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <ToastProvider>
      <AuthGuard />
      <div className="min-h-screen bg-gray-50">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
        {drawerOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
        )}
        <div
          className="transition-[margin] duration-300 lg:ml-[var(--side-w)]"
          style={
            { ["--side-w" as string]: collapsed ? "4rem" : "16rem" } as React.CSSProperties
          }
        >
          <Header onOpenDrawer={() => setDrawerOpen(true)} />
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
