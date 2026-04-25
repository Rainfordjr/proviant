"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Eye, Grid3X3, Save, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";

interface Site {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  grid_rows: number;
  grid_cols: number;
}

interface Zone {
  id: string;
  name: string;
  color: string;
  zone_type: string;
  grid_row: number;
  grid_col: number;
  grid_row_span: number;
  grid_col_span: number;
  description: string | null;
}

const ZONE_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

const ZONE_TYPES = [
  { value: "storage", label: "Storage" },
  { value: "receiving", label: "Receiving" },
  { value: "shipping", label: "Shipping" },
  { value: "production", label: "Production" },
  { value: "cold", label: "Cold Storage" },
  { value: "freezer", label: "Freezer" },
  { value: "quarantine", label: "Quarantine" },
  { value: "other", label: "Other" },
];

type ViewMode = "design" | "visual";

export default function WarehouseSiteDetailPage() {
  const { loading: permLoading } = useRequirePermission("warehouse.view");
  const params = useParams();
  const siteId = params.id as string;
  const router = useRouter();

  const [site, setSite] = useState<Site | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("design");
  const [loading, setLoading] = useState(true);

  // Zone creation/editing
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneType, setZoneType] = useState("storage");
  const [zoneColor, setZoneColor] = useState(ZONE_COLORS[0]);
  const [zoneRow, setZoneRow] = useState(0);
  const [zoneCol, setZoneCol] = useState(0);
  const [zoneRowSpan, setZoneRowSpan] = useState(2);
  const [zoneColSpan, setZoneColSpan] = useState(2);
  const [zoneDesc, setZoneDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: siteData } = await supabase
      .from("warehouse_sites")
      .select("*")
      .eq("id", siteId)
      .single();

    const { data: zoneData } = await supabase
      .from("warehouse_zones")
      .select("*")
      .eq("site_id", siteId)
      .order("name");

    if (siteData) setSite(siteData);
    if (zoneData) setZones(zoneData);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setZoneName("");
    setZoneType("storage");
    setZoneColor(ZONE_COLORS[zones.length % ZONE_COLORS.length]);
    setZoneRow(0);
    setZoneCol(0);
    setZoneRowSpan(2);
    setZoneColSpan(2);
    setZoneDesc("");
    setEditingZone(null);
    setShowZoneForm(false);
  };

  const startEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneType(zone.zone_type);
    setZoneColor(zone.color);
    setZoneRow(zone.grid_row);
    setZoneCol(zone.grid_col);
    setZoneRowSpan(zone.grid_row_span);
    setZoneColSpan(zone.grid_col_span);
    setZoneDesc(zone.description || "");
    setShowZoneForm(true);
  };

  const handleSaveZone = async () => {
    if (!site) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("users").select("org_id").eq("id", user?.id).single();

    const zoneData = {
      site_id: site.id,
      org_id: profile?.org_id,
      name: zoneName,
      zone_type: zoneType,
      color: zoneColor,
      grid_row: zoneRow,
      grid_col: zoneCol,
      grid_row_span: zoneRowSpan,
      grid_col_span: zoneColSpan,
      description: zoneDesc || null,
    };

    if (editingZone) {
      await supabase.from("warehouse_zones").update(zoneData).eq("id", editingZone.id);
    } else {
      await supabase.from("warehouse_zones").insert(zoneData);
    }

    setSaving(false);
    resetForm();
    loadData();
  };

  const handleDeleteZone = async (zoneId: string) => {
    const supabase = createClient();
    await supabase.from("warehouse_zones").delete().eq("id", zoneId);
    loadData();
  };

  const handleGridCellClick = (row: number, col: number) => {
    if (viewMode !== "design") return;
    // If a zone form is open, set the position
    if (showZoneForm) {
      setZoneRow(row);
      setZoneCol(col);
      return;
    }
    // Check if clicking on an existing zone
    const clickedZone = zones.find(
      (z) =>
        row >= z.grid_row && row < z.grid_row + z.grid_row_span &&
        col >= z.grid_col && col < z.grid_col + z.grid_col_span
    );
    if (clickedZone) {
      startEditZone(clickedZone);
    }
  };

  if (permLoading || loading) return <div className="p-8 text-center text-sm text-gray-500">Loading…</div>;
  if (!site) return <div className="p-8 text-center text-sm text-gray-500">Site not found.</div>;

  return (
    <div className="space-y-6">
      <Link href="/warehouse" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to Sites
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
          {site.address && <p className="text-sm text-gray-500">{site.address}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setViewMode("design")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === "design" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Grid3X3 size={14} /> Design
            </button>
            <button
              onClick={() => setViewMode("visual")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === "visual" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Eye size={14} /> Visual
            </button>
          </div>
          {viewMode === "design" && (
            <button
              onClick={() => { resetForm(); setShowZoneForm(true); setZoneColor(ZONE_COLORS[zones.length % ZONE_COLORS.length]); }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Add Zone
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm overflow-auto">
          <div
            className="inline-grid gap-px bg-gray-200"
            style={{
              gridTemplateRows: `repeat(${site.grid_rows}, minmax(40px, 1fr))`,
              gridTemplateColumns: `repeat(${site.grid_cols}, minmax(40px, 1fr))`,
              minWidth: site.grid_cols * 44,
            }}
          >
            {/* Render empty cells */}
            {Array.from({ length: site.grid_rows * site.grid_cols }).map((_, idx) => {
              const row = Math.floor(idx / site.grid_cols);
              const col = idx % site.grid_cols;

              // Check if this cell is covered by a zone
              const coveringZone = zones.find(
                (z) =>
                  row >= z.grid_row && row < z.grid_row + z.grid_row_span &&
                  col >= z.grid_col && col < z.grid_col + z.grid_col_span
              );

              // Only render the zone on its top-left cell
              const isZoneOrigin = coveringZone &&
                row === coveringZone.grid_row && col === coveringZone.grid_col;

              // Skip cells that are spanned by a zone (but not the origin)
              if (coveringZone && !isZoneOrigin) return null;

              if (isZoneOrigin && coveringZone) {
                return (
                  <div
                    key={`${row}-${col}`}
                    onClick={() => handleGridCellClick(row, col)}
                    className={`relative flex items-center justify-center text-white text-xs font-medium rounded-sm cursor-pointer transition-opacity hover:opacity-80 ${
                      viewMode === "visual" ? "p-2" : "p-1"
                    }`}
                    style={{
                      backgroundColor: coveringZone.color,
                      gridRow: `${row + 1} / span ${coveringZone.grid_row_span}`,
                      gridColumn: `${col + 1} / span ${coveringZone.grid_col_span}`,
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-sm">{coveringZone.name}</div>
                      {viewMode === "visual" && (
                        <div className="text-xs opacity-75 mt-0.5">
                          {ZONE_TYPES.find((t) => t.value === coveringZone.zone_type)?.label}
                        </div>
                      )}
                    </div>
                    {viewMode === "design" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteZone(coveringZone.id); }}
                        className="absolute top-1 right-1 rounded p-0.5 hover:bg-black/20"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              }

              // Highlight the cell if it matches the form position
              const isFormTarget = showZoneForm &&
                row >= zoneRow && row < zoneRow + zoneRowSpan &&
                col >= zoneCol && col < zoneCol + zoneColSpan;

              return (
                <div
                  key={`${row}-${col}`}
                  onClick={() => handleGridCellClick(row, col)}
                  className={`flex items-center justify-center text-xs transition-colors ${
                    viewMode === "design" ? "cursor-pointer hover:bg-blue-50" : ""
                  } ${isFormTarget ? "bg-blue-100 border border-blue-300 border-dashed" : "bg-white"}`}
                  style={{
                    gridRow: row + 1,
                    gridColumn: col + 1,
                  }}
                >
                  {viewMode === "design" && (
                    <span className="text-gray-300 text-[10px]">{row},{col}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Zone form sidebar (design mode only) */}
        {viewMode === "design" && showZoneForm && (
          <div className="w-80 shrink-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4 self-start sticky top-20">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingZone ? "Edit Zone" : "New Zone"}
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Dry Storage"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={zoneType}
                onChange={(e) => setZoneType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {ZONE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
              <div className="flex gap-2 flex-wrap">
                {ZONE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setZoneColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      zoneColor === c ? "border-gray-900 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Row</label>
                <input
                  type="number"
                  min={0}
                  max={site.grid_rows - 1}
                  value={zoneRow}
                  onChange={(e) => setZoneRow(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Column</label>
                <input
                  type="number"
                  min={0}
                  max={site.grid_cols - 1}
                  value={zoneCol}
                  onChange={(e) => setZoneCol(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Height</label>
                <input
                  type="number"
                  min={1}
                  max={site.grid_rows - zoneRow}
                  value={zoneRowSpan}
                  onChange={(e) => setZoneRowSpan(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
                <input
                  type="number"
                  min={1}
                  max={site.grid_cols - zoneCol}
                  value={zoneColSpan}
                  onChange={(e) => setZoneColSpan(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-gray-400">Tip: click a cell on the grid to set the position.</p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={zoneDesc}
                onChange={(e) => setZoneDesc(e.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveZone}
                disabled={!zoneName || saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? "Saving…" : editingZone ? "Update" : "Add Zone"}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Zone list sidebar (visual mode) */}
        {viewMode === "visual" && zones.length > 0 && (
          <div className="w-64 shrink-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm self-start sticky top-20">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Zones</h3>
            <div className="space-y-2">
              {zones.map((zone) => (
                <div key={zone.id} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2">
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: zone.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{zone.name}</p>
                    <p className="text-xs text-gray-500">
                      {ZONE_TYPES.find((t) => t.value === zone.zone_type)?.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
