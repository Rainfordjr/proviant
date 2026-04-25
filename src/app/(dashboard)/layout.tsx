"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div
          className="transition-all duration-300"
          style={{ marginLeft: collapsed ? "4rem" : "16rem" }}
        >
          <Header />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
