import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { ToastProvider } from "@/components/ui/toast";
import { AuthGuard } from "@/components/auth/auth-guard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the entire admin section — redirects if not a platform admin
  await requirePlatformAdmin();

  return (
    <ToastProvider>
      <AuthGuard />
      <div className="min-h-screen bg-gray-950">
        <AdminSidebar />
        <div className="ml-64 transition-all duration-300">
          <AdminHeader />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
