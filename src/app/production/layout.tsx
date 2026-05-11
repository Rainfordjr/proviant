import type { Metadata, Viewport } from "next";
import { requirePermission } from "@/lib/permissions";
import { ProductionShell } from "./shell";

export const metadata: Metadata = {
  title: "Proviant Production",
  applicationName: "Proviant Production",
  appleWebApp: {
    capable: true,
    title: "Production",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function ProductionLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("batches.view");
  return <ProductionShell>{children}</ProductionShell>;
}
