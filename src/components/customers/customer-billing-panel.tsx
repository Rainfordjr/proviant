"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowDownLeft,
  Gift,
  FileText,
  Receipt,
  XCircle,
  CreditCard,
  Building2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------
// Authorize.Net Accept.js — minimal type stub for the global it
// adds to `window`. We dynamically inject the script when the user
// chooses to charge a card.
// ---------------------------------------------------------------
interface AcceptDispatchResponse {
  messages: {
    resultCode: "Ok" | "Error";
    message: { code: string; text: string }[];
  };
  opaqueData?: {
    dataDescriptor: string;
    dataValue: string;
  };
}

interface AcceptDispatchInput {
  authData: { clientKey: string; apiLoginID: string };
  cardData: {
    cardNumber: string;
    month: string;
    year: string;
    cardCode: string;
    zip?: string;
    fullName?: string;
  };
}

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        input: AcceptDispatchInput,
        callback: (resp: AcceptDispatchResponse) => void
      ) => void;
    };
  }
}

type InvoiceStatus = "open" | "partial" | "paid" | "void";

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  kind: "invoice" | "credit_note";
  status: InvoiceStatus;
  issued_at: string;
  total: number;
  applied: number; // sum of payment_applications for this invoice
  order_id: string | null;
  notes: string | null;
}

export interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  reference_number: string | null;
  received_at: string;
  notes: string | null;
  applications: { invoice_id: string; invoice_number: string; amount: number }[];
}

export interface SavedCardRow {
  id: string;
  card_type: string | null;
  card_last4: string | null;
  card_exp_month: string | null;
  card_exp_year: string | null;
  cardholder_name: string | null;
  is_default: boolean;
  created_at: string;
}

interface Props {
  customerId: string;
  customerName: string;
  balance: number;
  /** Sum of payment amounts not yet allocated to any invoice. */
  creditAvailable: number;
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  savedCards: SavedCardRow[];
  canManage: boolean;
}

type Action = "charge" | "credit" | "payment" | "card" | "ach" | "card-add";

const STATUS_PILL: Record<InvoiceStatus, string> = {
  open: "bg-amber-100 text-amber-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-gray-100 text-gray-500 line-through",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  card: "Card",
  ach: "ACH",
  other: "Other",
};

function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CustomerBillingPanel({
  customerId,
  customerName,
  balance,
  creditAvailable,
  invoices,
  payments,
  savedCards,
  canManage,
}: Props) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charge / credit form state — single line item for v1.
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "check" | "card" | "ach" | "other"
  >("other");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  // Map of invoice_id -> amount-string the user wants to apply.
  // Only invoices that the user opted in to are present.
  const [paymentAllocations, setPaymentAllocations] = useState<
    Record<string, string>
  >({});

  // Card form state — used by both "card" (charge) and "card-add" (save) actions
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCode, setCardCode] = useState("");
  const [cardZip, setCardZip] = useState("");
  const [cardName, setCardName] = useState("");
  const [authNetConfig, setAuthNetConfig] = useState<{
    configured: boolean;
    environment?: "sandbox" | "production";
    api_login_id?: string;
    public_client_key?: string;
  } | null>(null);
  const [acceptJsLoaded, setAcceptJsLoaded] = useState(false);

  // Charge Card form: pick a saved card or fall back to a one-off entry.
  const [chargeMode, setChargeMode] = useState<"saved" | "oneoff">(
    savedCards.length > 0 ? "saved" : "oneoff"
  );
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string>(
    savedCards.find((c) => c.is_default)?.id ?? savedCards[0]?.id ?? ""
  );

  // Add Card form: also has an "is_default" toggle.
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // ACH state (Bill.com)
  const [achRouting, setAchRouting] = useState("");
  const [achAccount, setAchAccount] = useState("");
  const [achHolder, setAchHolder] = useState("");
  const [achType, setAchType] = useState<"checking" | "savings">("checking");

  // When the user opens any card-entry flow (charge with one-off, or add
  // a card to file), load Accept.js and the org's public Authorize.Net
  // config. For a charge against a saved card we don't need Accept.js.
  useEffect(() => {
    const needsAcceptJs =
      action === "card-add" || (action === "card" && chargeMode === "oneoff");
    if (!needsAcceptJs) return;

    let cancelled = false;
    fetch("/api/customer-billing/auth-net-config")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAuthNetConfig(data);

        if (data.configured && !window.Accept) {
          // Inject the right Accept.js for this environment.
          const src =
            data.environment === "production"
              ? "https://js.authorize.net/v1/Accept.js"
              : "https://jstest.authorize.net/v1/Accept.js";
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.charset = "utf-8";
          script.onload = () => setAcceptJsLoaded(true);
          script.onerror = () =>
            setError("Failed to load Authorize.Net Accept.js");
          document.head.appendChild(script);
        } else if (window.Accept) {
          setAcceptJsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load card-payment config");
      });

    return () => {
      cancelled = true;
    };
  }, [action, chargeMode]);

  const openInvoices = invoices.filter(
    (i) => i.kind === "invoice" && i.status !== "paid" && i.status !== "void"
  );

  const reset = () => {
    setAction(null);
    setSaving(false);
    setError(null);
    setDescription("");
    setAmount("");
    setPaymentMethod("other");
    setPaymentRef("");
    setPaymentNotes("");
    setPaymentAllocations({});
    setCardNumber("");
    setCardExpMonth("");
    setCardExpYear("");
    setCardCode("");
    setCardZip("");
    setCardName("");
    setAchRouting("");
    setAchAccount("");
    setAchHolder("");
    setAchType("checking");
    setSaveAsDefault(false);
    setChargeMode(savedCards.length > 0 ? "saved" : "oneoff");
    setSelectedSavedCardId(
      savedCards.find((c) => c.is_default)?.id ?? savedCards[0]?.id ?? ""
    );
  };

  const toggleInvoiceAllocation = (inv: InvoiceRow) => {
    setPaymentAllocations((prev) => {
      const next = { ...prev };
      if (inv.id in next) {
        delete next[inv.id];
      } else {
        const remaining = Math.max(0, inv.total - inv.applied);
        next[inv.id] = remaining.toFixed(2);
      }
      return next;
    });
  };

  const setAllocationAmount = (invoiceId: string, value: string) => {
    setPaymentAllocations((prev) => ({ ...prev, [invoiceId]: value }));
  };

  const allocationTotal = Object.values(paymentAllocations).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );

  const submitChargeOrCredit = async (kind: "charge" | "credit") => {
    if (saving) return;
    setSaving(true);
    setError(null);

    const num = parseFloat(amount);
    if (!description.trim() || !num || num <= 0) {
      setError("Provide a description and a positive amount.");
      setSaving(false);
      return;
    }

    const endpoint =
      kind === "charge"
        ? "/api/customer-billing/invoices"
        : "/api/customer-billing/credit-notes";

    const body =
      kind === "charge"
        ? {
            customer_id: customerId,
            line_items: [
              {
                description: description.trim(),
                quantity: 1,
                unit_price: num,
              },
            ],
          }
        : {
            customer_id: customerId,
            line_items: [
              {
                description: description.trim(),
                quantity: 1,
                unit_price: num,
              },
            ],
          };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data?.error ?? "Failed to save");
      setSaving(false);
      return;
    }

    reset();
    router.refresh();
  };

  const submitPayment = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setError("Enter a positive payment amount.");
      setSaving(false);
      return;
    }

    if (allocationTotal > num + 0.005) {
      setError(
        `Applications total $${allocationTotal.toFixed(
          2
        )} exceeds payment amount $${num.toFixed(2)}.`
      );
      setSaving(false);
      return;
    }

    const applications = Object.entries(paymentAllocations)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([invoice_id, v]) => ({
        invoice_id,
        amount: parseFloat(v),
      }));

    const res = await fetch("/api/customer-billing/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": newIdempotencyKey(),
      },
      body: JSON.stringify({
        customer_id: customerId,
        amount: num,
        method: paymentMethod,
        reference_number: paymentRef || null,
        notes: paymentNotes || null,
        applications,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data?.error ?? "Failed to record payment");
      setSaving(false);
      return;
    }

    reset();
    router.refresh();
  };

  // ─── Card charge ──────────────────────────────────────────────────
  // Two paths:
  //   chargeMode = "saved"   → POST /charge-saved with payment_profile_id
  //                            (no card data ever crosses our server)
  //   chargeMode = "oneoff"  → tokenize via Accept.js, POST /charge-card
  //                            (used rarely, e.g. walk-in or one-time card)
  const submitCardCharge = async () => {
    if (saving) return;
    setError(null);

    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (allocationTotal > num + 0.005) {
      setError(
        `Applications total $${allocationTotal.toFixed(
          2
        )} exceeds charge amount $${num.toFixed(2)}.`
      );
      return;
    }

    if (chargeMode === "saved") {
      if (!selectedSavedCardId) {
        setError("Pick a saved card to charge.");
        return;
      }

      setSaving(true);
      const applications = Object.entries(paymentAllocations)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([invoice_id, v]) => ({
          invoice_id,
          amount: parseFloat(v),
        }));

      const res = await fetch("/api/customer-billing/charge-saved", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": newIdempotencyKey(),
        },
        body: JSON.stringify({
          payment_profile_id: selectedSavedCardId,
          amount: num,
          description: `Card charge for ${customerName}`,
          notes: paymentNotes || null,
          applications,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data?.error ?? "Card was declined or charge failed.");
        setSaving(false);
        return;
      }

      reset();
      router.refresh();
      return;
    }

    // ── chargeMode === "oneoff" ──────────────────────────────────
    if (!authNetConfig?.configured) {
      setError(
        "Authorize.Net is not configured. Visit Settings → Payment Gateways."
      );
      return;
    }
    if (!acceptJsLoaded || typeof window === "undefined" || !window.Accept) {
      setError("Card payment library is still loading — try again in a sec.");
      return;
    }
    if (!cardNumber || !cardExpMonth || !cardExpYear || !cardCode) {
      setError("Fill in all card fields.");
      return;
    }

    setSaving(true);

    // Tokenize via Accept.js — card data goes from the browser to
    // Authorize.Net, never to our server.
    window.Accept.dispatchData(
      {
        authData: {
          apiLoginID: authNetConfig.api_login_id!,
          clientKey: authNetConfig.public_client_key!,
        },
        cardData: {
          cardNumber: cardNumber.replace(/\s/g, ""),
          month: cardExpMonth,
          year: cardExpYear,
          cardCode,
          zip: cardZip || undefined,
          fullName: cardName || undefined,
        },
      },
      async (resp) => {
        if (resp.messages.resultCode !== "Ok" || !resp.opaqueData) {
          const msg =
            resp.messages.message?.[0]?.text ??
            "Card tokenization failed. Check the card details.";
          setError(msg);
          setSaving(false);
          return;
        }

        const applications = Object.entries(paymentAllocations)
          .filter(([, v]) => parseFloat(v) > 0)
          .map(([invoice_id, v]) => ({
            invoice_id,
            amount: parseFloat(v),
          }));

        const res = await fetch("/api/customer-billing/charge-card", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": newIdempotencyKey(),
          },
          body: JSON.stringify({
            customer_id: customerId,
            amount: num,
            opaque_data: resp.opaqueData,
            description: `Card charge for ${customerName}`,
            notes: paymentNotes || null,
            applications,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          setError(data?.error ?? "Card was declined or charge failed.");
          setSaving(false);
          return;
        }

        reset();
        router.refresh();
      }
    );
  };

  // ─── ACH transfer (Bill.com) ──────────────────────────────────────
  // ─── Add Card (save to file, no charge) ──────────────────────────
  const submitAddCard = async () => {
    if (saving) return;
    setError(null);

    if (!authNetConfig?.configured) {
      setError(
        "Authorize.Net is not configured. Visit Settings → Payment Gateways."
      );
      return;
    }
    if (!acceptJsLoaded || typeof window === "undefined" || !window.Accept) {
      setError("Card payment library is still loading — try again in a sec.");
      return;
    }

    if (!cardNumber || !cardExpMonth || !cardExpYear || !cardCode) {
      setError("Fill in all card fields.");
      return;
    }

    const last4 = cardNumber.replace(/\D/g, "").slice(-4);
    if (last4.length !== 4) {
      setError("Card number looks too short.");
      return;
    }

    setSaving(true);

    // Tokenize via Accept.js, then POST the opaque token to our server.
    window.Accept.dispatchData(
      {
        authData: {
          apiLoginID: authNetConfig.api_login_id!,
          clientKey: authNetConfig.public_client_key!,
        },
        cardData: {
          cardNumber: cardNumber.replace(/\s/g, ""),
          month: cardExpMonth,
          year: cardExpYear,
          cardCode,
          zip: cardZip || undefined,
          fullName: cardName || undefined,
        },
      },
      async (resp) => {
        if (resp.messages.resultCode !== "Ok" || !resp.opaqueData) {
          setError(
            resp.messages.message?.[0]?.text ??
              "Card tokenization failed. Check the card details."
          );
          setSaving(false);
          return;
        }

        const res = await fetch("/api/customer-billing/payment-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: customerId,
            opaque_data: resp.opaqueData,
            card_last4: last4,
            card_exp_month: cardExpMonth,
            card_exp_year: cardExpYear,
            cardholder_name: cardName || null,
            billing_zip: cardZip || null,
            is_default: saveAsDefault,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data?.error ?? "Failed to save card.");
          setSaving(false);
          return;
        }

        reset();
        router.refresh();
      }
    );
  };

  // ─── Delete a saved card ─────────────────────────────────────────
  const deleteSavedCard = async (cardId: string) => {
    if (
      !confirm(
        "Remove this card from the customer's profile? It will also be deleted from Authorize.Net."
      )
    ) {
      return;
    }
    const res = await fetch(`/api/customer-billing/payment-profiles/${cardId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data?.error ?? "Failed to remove card.");
    }
  };

  const submitAch = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setError("Enter a positive amount.");
      setSaving(false);
      return;
    }
    if (!achRouting.match(/^\d{9}$/)) {
      setError("Routing number must be 9 digits.");
      setSaving(false);
      return;
    }
    if (achAccount.length < 4) {
      setError("Account number is too short.");
      setSaving(false);
      return;
    }
    if (!achHolder.trim()) {
      setError("Account holder name is required.");
      setSaving(false);
      return;
    }

    if (allocationTotal > num + 0.005) {
      setError(
        `Applications total $${allocationTotal.toFixed(
          2
        )} exceeds transfer amount $${num.toFixed(2)}.`
      );
      setSaving(false);
      return;
    }

    const applications = Object.entries(paymentAllocations)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([invoice_id, v]) => ({
        invoice_id,
        amount: parseFloat(v),
      }));

    const res = await fetch("/api/customer-billing/initiate-ach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": newIdempotencyKey(),
      },
      body: JSON.stringify({
        customer_id: customerId,
        amount: num,
        routing_number: achRouting,
        account_number: achAccount,
        account_holder_name: achHolder,
        account_type: achType,
        notes: paymentNotes || null,
        applications,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data?.error ?? "Failed to initiate ACH transfer.");
      setSaving(false);
      return;
    }

    reset();
    router.refresh();
  };

  const balanceColor =
    balance > 0
      ? "text-red-700"
      : balance < 0
      ? "text-green-700"
      : "text-gray-700";
  const balanceLabel =
    balance > 0
      ? "Customer owes"
      : balance < 0
      ? "Credit on account"
      : "Settled";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Billing &amp; Payments
          </h2>
          <p className="text-sm text-gray-500">
            Invoices, credits, and payments for {customerName}.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {balanceLabel}
          </p>
          <p className={`text-2xl font-bold ${balanceColor}`}>
            ${Math.abs(balance).toFixed(2)}
          </p>
          {creditAvailable > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
              ${creditAvailable.toFixed(2)} credit available
            </p>
          )}
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (action === "charge") reset();
              else {
                reset();
                setAction("charge");
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              action === "charge"
                ? "bg-red-600 text-white"
                : "border border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            <Plus size={14} /> Add Charge
          </button>
          <button
            type="button"
            onClick={() => {
              if (action === "payment") reset();
              else {
                reset();
                setAction("payment");
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              action === "payment"
                ? "bg-green-600 text-white"
                : "border border-green-300 text-green-700 hover:bg-green-50"
            }`}
          >
            <ArrowDownLeft size={14} /> Record Payment
          </button>
          <button
            type="button"
            onClick={() => {
              if (action === "credit") reset();
              else {
                reset();
                setAction("credit");
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              action === "credit"
                ? "bg-blue-600 text-white"
                : "border border-blue-300 text-blue-700 hover:bg-blue-50"
            }`}
          >
            <Gift size={14} /> Issue Credit
          </button>
          <button
            type="button"
            onClick={() => {
              if (action === "card") reset();
              else {
                reset();
                setAction("card");
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              action === "card"
                ? "bg-violet-600 text-white"
                : "border border-violet-300 text-violet-700 hover:bg-violet-50"
            }`}
          >
            <CreditCard size={14} /> Charge Card
          </button>
          <button
            type="button"
            onClick={() => {
              if (action === "ach") reset();
              else {
                reset();
                setAction("ach");
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              action === "ach"
                ? "bg-teal-600 text-white"
                : "border border-teal-300 text-teal-700 hover:bg-teal-50"
            }`}
          >
            <Building2 size={14} /> Initiate ACH
          </button>
          <button
            type="button"
            onClick={() => {
              if (action === "card-add") reset();
              else {
                reset();
                setAction("card-add");
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              action === "card-add"
                ? "bg-slate-700 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Plus size={14} /> Add Card
          </button>
        </div>
      )}

      {action === "charge" || action === "credit" ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {action === "charge" ? "New Charge" : "New Credit Note"}
          </h3>
          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={
                action === "charge"
                  ? "e.g., Delivery fee, Late charge"
                  : "e.g., Spoilage refund, Goodwill credit"
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Amount ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => submitChargeOrCredit(action)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : action === "charge"
                ? "Create Invoice"
                : "Issue Credit"}
            </button>
          </div>
        </div>
      ) : null}

      {action === "payment" ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Record Payment</h3>
          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Amount ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as typeof paymentMethod)
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
                <option value="ach">ACH</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Reference #
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Check #, transaction ID"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Notes
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Apply-to-invoices section */}
          {openInvoices.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">
                  Apply to invoices (optional)
                </label>
                <span
                  className={`text-xs ${
                    allocationTotal > parseFloat(amount || "0") + 0.005
                      ? "text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  Allocated ${allocationTotal.toFixed(2)} of $
                  {(parseFloat(amount) || 0).toFixed(2)}
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {openInvoices.map((inv) => {
                  const remaining = Math.max(0, inv.total - inv.applied);
                  const checked = inv.id in paymentAllocations;
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleInvoiceAllocation(inv)}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {inv.invoice_number}
                        </div>
                        <div className="text-xs text-gray-500">
                          Issued {formatDate(inv.issued_at)} · ${inv.total.toFixed(2)}{" "}
                          ({remaining.toFixed(2)} remaining)
                        </div>
                      </div>
                      {checked && (
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={remaining.toString()}
                          value={paymentAllocations[inv.id]}
                          onChange={(e) =>
                            setAllocationAmount(inv.id, e.target.value)
                          }
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500">
                Any payment amount not allocated stays as a credit on the
                customer&apos;s account.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submitPayment}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </div>
      ) : null}

      {action === "card" ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Charge Card</h3>
          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {!authNetConfig ? (
            <p className="text-sm text-gray-500">Loading gateway config…</p>
          ) : !authNetConfig.configured ? (
            <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              Authorize.Net is not configured.{" "}
              <a
                href="/settings/payment-gateways"
                className="underline font-medium"
              >
                Add credentials
              </a>{" "}
              to take card payments.
            </p>
          ) : (
            <>
              {chargeMode === "oneoff" && !acceptJsLoaded && (
                <p className="text-xs text-gray-500">
                  Loading Accept.js{authNetConfig.environment === "sandbox" ? " (sandbox)" : ""}…
                </p>
              )}

              {/* Mode toggle: saved card vs one-off entry */}
              {savedCards.length > 0 ? (
                <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setChargeMode("saved")}
                    className={`flex-1 rounded px-2 py-1 font-medium transition ${
                      chargeMode === "saved"
                        ? "bg-violet-600 text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Saved card
                  </button>
                  <button
                    type="button"
                    onClick={() => setChargeMode("oneoff")}
                    className={`flex-1 rounded px-2 py-1 font-medium transition ${
                      chargeMode === "oneoff"
                        ? "bg-violet-600 text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    One-time card
                  </button>
                </div>
              ) : (
                <p className="rounded border border-gray-200 bg-white p-2 text-xs text-gray-600">
                  No saved cards on file. Use{" "}
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      setAction("card-add");
                    }}
                    className="font-medium text-violet-700 hover:underline"
                  >
                    Add Card
                  </button>{" "}
                  to save one — or enter a one-time card below.
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Saved card picker */}
              {chargeMode === "saved" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Card on file *
                  </label>
                  <select
                    value={selectedSavedCardId}
                    onChange={(e) => setSelectedSavedCardId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {savedCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.card_type ?? "Card"} •••• {c.card_last4 ?? "????"}
                        {c.card_exp_month && c.card_exp_year
                          ? ` · exp ${c.card_exp_month}/${c.card_exp_year.slice(-2)}`
                          : ""}
                        {c.is_default ? " · default" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* One-time card entry — used rarely */}
              {chargeMode === "oneoff" && (
                <>
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="As it appears on the card"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Card Number *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={(e) =>
                    setCardNumber(e.target.value.replace(/[^\d ]/g, ""))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="4111 1111 1111 1111"
                  maxLength={23}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Exp. Month *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp-month"
                    value={cardExpMonth}
                    onChange={(e) =>
                      setCardExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="MM"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Exp. Year *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp-year"
                    value={cardExpYear}
                    onChange={(e) =>
                      setCardExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="YYYY"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    CVV *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={cardCode}
                    onChange={(e) =>
                      setCardCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="123"
                    maxLength={4}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Billing ZIP
                </label>
                <input
                  type="text"
                  value={cardZip}
                  onChange={(e) => setCardZip(e.target.value)}
                  className="mt-1 w-1/3 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="ZIP"
                />
              </div>

              <p className="text-[11px] text-gray-500">
                Card data is tokenized in your browser by Authorize.Net Accept.js
                — it&apos;s never sent to our servers.
              </p>
                </>
              )}

              {/* Apply-to-invoices reuses the payment allocation UI */}
              {openInvoices.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600">
                      Apply to invoices (optional)
                    </label>
                    <span
                      className={`text-xs ${
                        allocationTotal > parseFloat(amount || "0") + 0.005
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      Allocated ${allocationTotal.toFixed(2)} of $
                      {(parseFloat(amount) || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                    {openInvoices.map((inv) => {
                      const remaining = Math.max(0, inv.total - inv.applied);
                      const checked = inv.id in paymentAllocations;
                      return (
                        <div
                          key={inv.id}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleInvoiceAllocation(inv)}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {inv.invoice_number}
                            </div>
                            <div className="text-xs text-gray-500">
                              ${inv.total.toFixed(2)} ({remaining.toFixed(2)} remaining)
                            </div>
                          </div>
                          {checked && (
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={remaining.toString()}
                              value={paymentAllocations[inv.id]}
                              onChange={(e) =>
                                setAllocationAmount(inv.id, e.target.value)
                              }
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    saving ||
                    (chargeMode === "oneoff" && !acceptJsLoaded) ||
                    (chargeMode === "saved" && !selectedSavedCardId)
                  }
                  onClick={submitCardCharge}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? "Charging…" : "Charge Card"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {action === "card-add" ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Add Card to File
          </h3>
          <p className="text-xs text-gray-600">
            Save a card to {customerName}&apos;s profile so future charges
            can be run with one click. The card data is tokenized by Authorize.Net
            Accept.js in your browser and stored on their servers — Proviant
            only keeps the masked summary.
          </p>
          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {!authNetConfig ? (
            <p className="text-sm text-gray-500">Loading gateway config…</p>
          ) : !authNetConfig.configured ? (
            <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              Authorize.Net is not configured.{" "}
              <a
                href="/settings/payment-gateways"
                className="underline font-medium"
              >
                Add credentials
              </a>{" "}
              first.
            </p>
          ) : (
            <>
              {!acceptJsLoaded && (
                <p className="text-xs text-gray-500">
                  Loading Accept.js{authNetConfig.environment === "sandbox" ? " (sandbox)" : ""}…
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="As it appears on the card"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Card Number *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={(e) =>
                    setCardNumber(e.target.value.replace(/[^\d ]/g, ""))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="4111 1111 1111 1111"
                  maxLength={23}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Exp. Month *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp-month"
                    value={cardExpMonth}
                    onChange={(e) =>
                      setCardExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="MM"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Exp. Year *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp-year"
                    value={cardExpYear}
                    onChange={(e) =>
                      setCardExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="YYYY"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    CVV *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={cardCode}
                    onChange={(e) =>
                      setCardCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="123"
                    maxLength={4}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Billing ZIP
                </label>
                <input
                  type="text"
                  value={cardZip}
                  onChange={(e) => setCardZip(e.target.value)}
                  className="mt-1 w-1/3 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="ZIP"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                />
                Set as the default card for this customer
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !acceptJsLoaded}
                  onClick={submitAddCard}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Card"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Saved cards on file */}
      {savedCards.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <CreditCard size={14} className="text-gray-400" />
            Cards on File ({savedCards.length})
          </h3>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Card</th>
                  <th className="px-3 py-2 text-left">Cardholder</th>
                  <th className="px-3 py-2 text-left">Expires</th>
                  <th className="px-3 py-2 text-left">Default</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {savedCards.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {c.card_type ?? "Card"} •••• {c.card_last4 ?? "????"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {c.cardholder_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {c.card_exp_month && c.card_exp_year
                        ? `${c.card_exp_month}/${c.card_exp_year.slice(-2)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {c.is_default ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                          default
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => deleteSavedCard(c.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {action === "ach" ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Initiate ACH Transfer
          </h3>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Note: live Bill.com submission is stubbed. Recorded ACH transfers
            stay in <strong>pending</strong> until you mark them cleared.
          </p>
          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Amount ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Account Type
              </label>
              <select
                value={achType}
                onChange={(e) =>
                  setAchType(e.target.value as "checking" | "savings")
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">
              Account Holder Name *
            </label>
            <input
              type="text"
              value={achHolder}
              onChange={(e) => setAchHolder(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="As it appears on the bank account"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Routing Number * (9 digits)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={achRouting}
                onChange={(e) =>
                  setAchRouting(e.target.value.replace(/\D/g, "").slice(0, 9))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="123456789"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Account Number *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={achAccount}
                onChange={(e) =>
                  setAchAccount(e.target.value.replace(/\D/g, ""))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="00000000000"
              />
            </div>
          </div>

          {/* Apply-to-invoices reuses the payment allocation UI */}
          {openInvoices.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">
                  Apply to invoices (optional)
                </label>
                <span
                  className={`text-xs ${
                    allocationTotal > parseFloat(amount || "0") + 0.005
                      ? "text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  Allocated ${allocationTotal.toFixed(2)} of $
                  {(parseFloat(amount) || 0).toFixed(2)}
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {openInvoices.map((inv) => {
                  const remaining = Math.max(0, inv.total - inv.applied);
                  const checked = inv.id in paymentAllocations;
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleInvoiceAllocation(inv)}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {inv.invoice_number}
                        </div>
                        <div className="text-xs text-gray-500">
                          ${inv.total.toFixed(2)} ({remaining.toFixed(2)} remaining)
                        </div>
                      </div>
                      {checked && (
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={remaining.toString()}
                          value={paymentAllocations[inv.id]}
                          onChange={(e) =>
                            setAllocationAmount(inv.id, e.target.value)
                          }
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submitAch}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Submitting…" : "Initiate ACH"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Invoices */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FileText size={14} className="text-gray-400" />
          Invoices &amp; Credits ({invoices.length})
        </h3>
        {invoices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
            No invoices yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Number</th>
                  <th className="px-3 py-2 text-left">Issued</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const remaining =
                    inv.kind === "credit_note"
                      ? 0
                      : Math.max(0, inv.total - inv.applied);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">
                          {inv.invoice_number}
                        </div>
                        <div className="text-xs text-gray-500">
                          {inv.kind === "credit_note"
                            ? "Credit note"
                            : "Invoice"}
                          {inv.order_id && " · from order"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {formatDate(inv.issued_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_PILL[inv.status]
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          inv.total < 0 ? "text-blue-700" : "text-gray-900"
                        }`}
                      >
                        ${inv.total.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {inv.kind === "credit_note"
                          ? "—"
                          : `$${remaining.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Receipt size={14} className="text-gray-400" />
          Payments ({payments.length})
        </h3>
        {payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
            No payments recorded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Received</th>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Applied to</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => {
                  const appliedSum = p.applications.reduce(
                    (s, a) => s + a.amount,
                    0
                  );
                  const unapplied = Math.max(0, p.amount - appliedSum);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700">
                        {formatDate(p.received_at)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {METHOD_LABEL[p.method] ?? p.method}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {p.reference_number ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {p.applications.length === 0 ? (
                          <span className="text-xs text-gray-500">
                            <XCircle size={11} className="inline mr-1" />
                            Unapplied (credit)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {p.applications.map((a) => (
                              <span
                                key={a.invoice_id}
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
                                title={`$${a.amount.toFixed(2)} applied`}
                              >
                                {a.invoice_number}
                              </span>
                            ))}
                            {unapplied > 0.005 && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                                +${unapplied.toFixed(2)} unapplied
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-green-700">
                        ${p.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
