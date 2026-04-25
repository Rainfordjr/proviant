"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import {
  LayoutDashboard, Package, Wheat, ShoppingBag, ShieldCheck,
  Warehouse, Truck, ChefHat, FlaskConical, Users, Search,
  BarChart3, Plug, Lock, Check, X,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Package, Wheat, ShoppingBag, ShieldCheck,
  Warehouse, Truck, ChefHat, FlaskConical, Users, Search,
  BarChart3, Plug,
};

const categoryLabels: Record<string, string> = {
  core: "Core",
  operations: "Operations",
  compliance: "Compliance",
  analytics: "Analytics",
  integrations: "Integrations",
};

const categoryColors: Record<string, string> = {
  core: "bg-blue-50 text-blue-700",
  operations: "bg-green-50 text-green-700",
  compliance: "bg-purple-50 text-purple-700",
  analytics: "bg-orange-50 text-orange-700",
  integrations: "bg-indigo-50 text-indigo-700",
};

interface ModuleData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_free: boolean;
  price_monthly: number | null;
  price_yearly: number | null;
  is_core: boolean;
  sort_order: number;
}

export default function ModulesPage() {
  const { loading: permLoading } = useRequirePermission("modules.manage");
  const router = useRouter();
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [activeModuleIds, setActiveModuleIds] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: allModules } = await supabase
        .from("modules")
        .select("*")
        .order("sort_order");

      const { data: orgModules } = await supabase
        .from("org_modules")
        .select("module_id, is_active");

      if (allModules) setModules(allModules);
      if (orgModules) {
        const active = new Set<string>();
        orgModules.forEach((om: any) => {
          if (om.is_active) active.add(om.module_id);
        });
        setActiveModuleIds(active);
      }
    }
    load();
  }, []);

  const toggleModule = async (moduleId: string, currentlyActive: boolean) => {
    setToggling(moduleId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (currentlyActive) {
      // Deactivate
      await supabase
        .from("org_modules")
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq("module_id", moduleId);

      setActiveModuleIds((prev) => {
        const next = new Set(prev);
        next.delete(moduleId);
        return next;
      });
    } else {
      // Activate — upsert in case there's an existing deactivated record
      const { data: existing } = await supabase
        .from("org_modules")
        .select("id")
        .eq("module_id", moduleId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("org_modules")
          .update({ is_active: true, activated_at: new Date().toISOString(), deactivated_at: null, activated_by: user?.id })
          .eq("id", existing.id);
      } else {
        await supabase.from("org_modules").insert({
          module_id: moduleId,
          org_id: (await supabase.from("users").select("org_id").eq("id", user?.id).single()).data?.org_id,
          is_active: true,
          activated_by: user?.id,
        });
      }

      setActiveModuleIds((prev) => new Set([...prev, moduleId]));
    }

    setToggling(null);
    router.refresh();
  };

  const categories = [...new Set(modules.map((m) => m.category))];
  const filteredModules = filterCategory === "all"
    ? modules
    : modules.filter((m) => m.category === filterCategory);

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
        <p className="text-sm text-gray-500">
          Activate or deactivate features for your organization
        </p>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory("all")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            filterCategory === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filterCategory === cat ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {categoryLabels[cat] || cat}
          </button>
        ))}
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredModules.map((mod) => {
          const isActive = activeModuleIds.has(mod.id);
          const Icon = iconMap[mod.icon || ""] || Package;
          const isToggling = toggling === mod.id;

          return (
            <div
              key={mod.id}
              className={`rounded-xl border p-5 shadow-sm transition-colors ${
                isActive
                  ? "border-blue-200 bg-blue-50/30"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  isActive ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                }`}>
                  <Icon size={20} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[mod.category] || "bg-gray-50 text-gray-600"}`}>
                    {categoryLabels[mod.category] || mod.category}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
              {mod.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{mod.description}</p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {mod.is_free ? (
                    <span className="text-green-600 font-medium">Free</span>
                  ) : (
                    <span>${mod.price_monthly}/mo</span>
                  )}
                </div>

                {mod.is_core ? (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Lock size={12} />
                    <span>Always on</span>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleModule(mod.id, isActive)}
                    disabled={isToggling}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isToggling ? "…" : isActive ? (
                      <><X size={12} /> Deactivate</>
                    ) : (
                      <><Check size={12} /> Activate</>
                    )}
                  </button>
                )}
              </div>

              {isActive && (
                <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                  <Check size={12} /> Active
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredModules.length === 0 && (
        <div className="p-8 text-center text-sm text-gray-500">No modules in this category.</div>
      )}
    </div>
  );
}
