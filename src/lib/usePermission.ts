"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side hook to check a permission. Redirects to dashboard if denied.
 * Returns { loading, allowed } so the page can show a loading state.
 */
export function useRequirePermission(permCode: string) {
  const router = useRouter();
  const [state, setState] = useState<{ loading: boolean; allowed: boolean }>({
    loading: true,
    allowed: false,
  });

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data } = await supabase.rpc("user_has_permission", {
        perm_code: permCode,
      });
      if (data === true) {
        setState({ loading: false, allowed: true });
      } else {
        router.replace("/dashboard?denied=" + encodeURIComponent(permCode));
      }
    }
    check();
  }, [permCode, router]);

  return state;
}

/**
 * Client-side hook to check if the current user has an admin role.
 * Redirects to dashboard if not admin.
 */
export function useRequireAdmin() {
  const router = useRouter();
  const [state, setState] = useState<{ loading: boolean; allowed: boolean }>({
    loading: true,
    allowed: false,
  });

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: adminCheck } = await supabase
        .from("user_roles")
        .select("roles!inner(is_admin)")
        .eq("user_id", user.id)
        .eq("roles.is_admin", true)
        .limit(1);

      if (adminCheck && adminCheck.length > 0) {
        setState({ loading: false, allowed: true });
      } else {
        router.replace("/dashboard?denied=admin");
      }
    }
    check();
  }, [router]);

  return state;
}
