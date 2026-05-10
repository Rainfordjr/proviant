import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { formatDate } from "@/lib/utils";
import { LabelPrintButton } from "./print-button";

export default async function LotLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("inventory.view");
  const { id } = await params;
  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("material_lots")
    .select("lot_number, barcode, expiry_date, received_at, raw_materials(name, ingredients(name))")
    .eq("id", id)
    .maybeSingle();

  if (!lot) return notFound();
  const material = (lot as unknown as { raw_materials: { name: string; ingredients: { name: string } | null } | null }).raw_materials;

  const qrData = lot.barcode || lot.lot_number;
  const qrSvg = await QRCode.toString(qrData, {
    type: "svg",
    margin: 0,
    width: 200,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="label-wrap">
      <style>{`
        @media print {
          @page { size: 3in 2in; margin: 0.1in; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .label-wrap { padding: 0 !important; max-width: none !important; }
        }
        .label-card {
          width: 2.8in;
          min-height: 1.8in;
          border: 1px solid #d1d5db;
          padding: 0.15in;
          background: white;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 9pt;
          color: #111827;
          display: flex;
          gap: 0.15in;
          align-items: flex-start;
        }
        .label-qr { flex: 0 0 1.4in; }
        .label-qr svg { width: 100%; height: auto; }
        .label-text { flex: 1; min-width: 0; }
        .label-text h2 { font-size: 11pt; font-weight: bold; margin: 0 0 4pt 0; }
        .label-text .meta { font-size: 8pt; color: #4b5563; }
        .label-text .barcode { font-family: ui-monospace, monospace; font-size: 7pt; margin-top: 4pt; word-break: break-all; }
      `}</style>
      <div className="no-print mb-4">
        <LabelPrintButton />
      </div>
      <div className="label-card">
        <div className="label-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="label-text">
          <h2>{material?.name || "—"}</h2>
          {material?.ingredients?.name && (
            <div className="meta">{material.ingredients.name}</div>
          )}
          <div className="meta" style={{ marginTop: 4 }}>Lot: <strong>{lot.lot_number}</strong></div>
          {lot.expiry_date && (
            <div className="meta">Exp: {formatDate(lot.expiry_date)}</div>
          )}
          <div className="meta">Recv: {formatDate(lot.received_at)}</div>
          <div className="barcode">{qrData}</div>
        </div>
      </div>
    </div>
  );
}
