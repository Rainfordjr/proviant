"use client";

import { useEffect, useState } from "react";
import { QrCode, Copy, Check } from "lucide-react";

export function ProductionQr() {
  const [url, setUrl] = useState<string>("");
  const [svg, setSvg] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = `${window.location.origin}/production`;
    setUrl(target);
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toString(target, { type: "svg", margin: 1, width: 256 })
      )
      .then((s) => setSvg(s))
      .catch(() => setSvg(""));
  }, []);

  async function copyUrl() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user gesture missing or clipboard unavailable */
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="block flex-shrink-0 rounded-lg border border-gray-200 p-2 bg-white"
          aria-label="Enlarge QR code"
          title="Tap to enlarge"
        >
          {svg ? (
            <div className="h-32 w-32 sm:h-36 sm:w-36" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="h-32 w-32 sm:h-36 sm:w-36 flex items-center justify-center text-gray-300">
              <QrCode size={48} />
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <QrCode size={16} /> Open on another device
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Scan with a tablet or phone camera to open the Production app on that device. Install it from the browser menu to launch full-screen.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-700">
              {url || "…"}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {enlarged && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setEnlarged(false)}
          role="dialog"
          aria-label="QR code enlarged"
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {svg ? (
              <div
                className="mx-auto w-full"
                style={{ maxWidth: "min(80vmin, 360px)" }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : null}
            <p className="mt-3 text-center text-sm text-gray-600 break-all">{url}</p>
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
