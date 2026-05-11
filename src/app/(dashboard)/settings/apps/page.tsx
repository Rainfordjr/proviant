"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, Copy, Check, ExternalLink, LayoutGrid, Factory } from "lucide-react";
import { useRequirePermission } from "@/lib/usePermission";

type SatelliteApp = {
  slug: string;
  name: string;
  path: string;
  description: string;
  icon: React.ElementType;
  permission: string;
};

const APPS: SatelliteApp[] = [
  {
    slug: "production",
    name: "Production",
    path: "/production",
    description:
      "Installable PWA for the production floor. Operators pick a line, consume scanned lots, and mark batches complete.",
    icon: Factory,
    permission: "batches.view",
  },
];

export default function SatelliteAppsPage() {
  const { loading: permLoading } = useRequirePermission("batches.view");
  const [origin, setOrigin] = useState("");
  const [qrFor, setQrFor] = useState<SatelliteApp | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  if (permLoading) {
    return <div className="p-8 text-sm text-gray-500">Checking permissions…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <LayoutGrid size={22} /> Apps
        </h1>
        <p className="text-sm text-gray-500">
          Satellite apps that ship alongside Proviant. Open one in a tab, install it on a phone or tablet, or share a QR code with another device.
        </p>
      </div>

      <ul className="space-y-3">
        {APPS.map((app) => {
          const Icon = app.icon;
          const url = origin ? `${origin}${app.path}` : app.path;
          return (
            <li
              key={app.slug}
              className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold text-gray-900">{app.name}</h2>
                    <code className="text-xs text-gray-500 truncate max-w-full">{url}</code>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{app.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={app.path}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <ExternalLink size={14} /> Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => setQrFor(app)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <QrCode size={14} /> Show QR
                    </button>
                    <CopyButton url={url} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {qrFor && origin && (
        <QrModal app={qrFor} url={`${origin}${qrFor.path}`} onClose={() => setQrFor(null)} />
      )}
    </div>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}

function QrModal({
  app,
  url: fallbackUrl,
  onClose,
}: {
  app: SatelliteApp;
  url: string;
  onClose: () => void;
}) {
  const [magicUrl, setMagicUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  // Mint a one-time sign-in link for the current user, then render its QR.
  // If link generation fails (e.g., Supabase redirect URL not whitelisted),
  // fall back to the plain URL — operator will just have to log in manually
  // after scanning, which is the previous behavior.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let target = fallbackUrl;
      try {
        const r = await fetch("/api/auth/qr-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ redirect: app.path }),
        });
        if (r.ok) {
          const j = await r.json();
          if (!cancelled && j.url) {
            target = j.url;
            setMagicUrl(j.url);
            setEmail(j.email ?? null);
          }
        }
      } catch {
        /* network error — fall through to fallback URL */
      }
      try {
        const { default: QRCode } = await import("qrcode");
        const d = await QRCode.toDataURL(target, {
          margin: 1,
          width: 512,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setDataUrl(d);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app.path, fallbackUrl]);

  const authed = !!magicUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
      role="dialog"
      aria-label={`${app.name} QR code`}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{app.name}</h2>
        <p className="text-sm text-gray-500">
          {authed
            ? `Scan with a phone or tablet to open the app and sign in as ${email ?? "you"}.`
            : "Scan to open the app. Sign in manually on that device."}
        </p>
        {authed && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
            One-time link. Don&apos;t share publicly — anyone who scans it within the next hour logs in as you.
          </p>
        )}
        <div className="mt-4 flex justify-center">
          {err ? (
            <p className="text-sm text-red-700">{err}</p>
          ) : dataUrl ? (
            <img
              src={dataUrl}
              alt={`${app.name} QR code`}
              className="block w-full max-w-[320px] rounded-lg"
            />
          ) : (
            <div className="h-64 w-64 flex items-center justify-center text-gray-300">
              <QrCode size={48} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
