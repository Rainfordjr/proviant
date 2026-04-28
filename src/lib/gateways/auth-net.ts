/**
 * Server-side Authorize.Net client.
 *
 * Uses Accept.js on the browser to tokenize card data into an opaque
 * { dataDescriptor, dataValue } pair that we pass through to the
 * `chargeOpaqueCard` call below. Card numbers never touch our servers,
 * which keeps PCI scope minimal (SAQ-A).
 *
 * Reference: https://developer.authorize.net/api/reference/index.html
 */

export interface AuthNetCredentials {
  environment: "sandbox" | "production";
  apiLoginId: string;
  transactionKey: string;
}

export interface ChargeOpaqueArgs {
  amount: number;            // dollars (e.g. 49.95)
  opaqueData: {
    dataDescriptor: string;  // e.g. "COMMON.ACCEPT.INAPP.PAYMENT"
    dataValue: string;       // the opaque token from Accept.js
  };
  invoiceNumber?: string;    // shows up in Authorize.Net dashboard
  description?: string;
}

export interface ChargeResult {
  ok: boolean;
  transactionId?: string;
  authCode?: string;
  responseCode?: string;
  message: string;           // human-readable
  raw: unknown;              // full Authorize.Net response, kept for the metadata jsonb
}

const ENDPOINTS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
} as const;

/**
 * Charge a card using an Accept.js opaque token. Returns a normalized
 * result so the caller doesn't have to walk Authorize.Net's nested response.
 */
export async function chargeOpaqueCard(
  credentials: AuthNetCredentials,
  args: ChargeOpaqueArgs
): Promise<ChargeResult> {
  if (!credentials.apiLoginId || !credentials.transactionKey) {
    return {
      ok: false,
      message: "Authorize.Net is not configured for this organization.",
      raw: null,
    };
  }

  const body = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: credentials.apiLoginId,
        transactionKey: credentials.transactionKey,
      },
      // Optional refId for client-side correlation; using a short timestamp.
      refId: String(Date.now()).slice(-20),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: args.amount.toFixed(2),
        payment: {
          opaqueData: args.opaqueData,
        },
        order: args.invoiceNumber
          ? {
              invoiceNumber: args.invoiceNumber.slice(0, 20),
              description: (args.description ?? "Customer payment").slice(0, 255),
            }
          : undefined,
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINTS[credentials.environment], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      message:
        "Network error calling Authorize.Net: " +
        (err instanceof Error ? err.message : String(err)),
      raw: null,
    };
  }

  // Authorize.Net responses are technically JSON but the spec says to strip
  // a UTF-8 BOM that's sometimes prepended.
  const text = (await res.text()).replace(/^﻿/, "");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      message: "Invalid response from Authorize.Net: " + text.slice(0, 200),
      raw: text,
    };
  }

  // Expected shape: { transactionResponse: { responseCode, transId, authCode, messages: { message: [{description}] } }, messages: { resultCode, message: [{ text }] } }
  type AuthNetResp = {
    transactionResponse?: {
      responseCode?: string;
      transId?: string;
      authCode?: string;
      messages?: { message?: { description?: string }[] };
      errors?: { error?: { errorCode?: string; errorText?: string }[] };
    };
    messages?: {
      resultCode?: string;
      message?: { code?: string; text?: string }[];
    };
  };
  const r = json as AuthNetResp;

  const tr = r.transactionResponse;
  const respCode = tr?.responseCode;

  if (respCode === "1") {
    return {
      ok: true,
      transactionId: tr?.transId,
      authCode: tr?.authCode,
      responseCode: respCode,
      message: tr?.messages?.message?.[0]?.description ?? "Approved",
      raw: json,
    };
  }

  // Build the most descriptive error message we can.
  const txErr = tr?.errors?.error?.[0];
  const topErr = r.messages?.message?.[0];
  const message =
    txErr?.errorText ||
    topErr?.text ||
    "Authorize.Net declined the transaction";

  return {
    ok: false,
    transactionId: tr?.transId,
    responseCode: respCode,
    message,
    raw: json,
  };
}


// ============================================================
// Customer Information Manager (CIM)
//
// CIM lets us store cards on Authorize.Net's servers. Once a card
// is saved, we charge by reference using { customerProfileId,
// paymentProfileId, amount } — the card data never returns to us
// and never crosses our network on subsequent charges.
// ============================================================

interface AuthNetMessages {
  messages?: {
    resultCode?: string;
    message?: { code?: string; text?: string }[];
  };
}

/** Strip BOM and parse Authorize.Net's JSON response. */
async function parseAuthNetResponse(res: Response): Promise<unknown> {
  const text = (await res.text()).replace(/^﻿/, "");
  return JSON.parse(text);
}

/** Pull the most descriptive error message off any Authorize.Net response. */
function extractErrorMessage(json: AuthNetMessages, fallback: string): string {
  return json.messages?.message?.[0]?.text ?? fallback;
}

async function postAuthNet(
  credentials: AuthNetCredentials,
  body: object
): Promise<{ ok: true; json: unknown } | { ok: false; message: string; json: unknown }> {
  if (!credentials.apiLoginId || !credentials.transactionKey) {
    return {
      ok: false,
      message: "Authorize.Net is not configured for this organization.",
      json: null,
    };
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINTS[credentials.environment], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      message:
        "Network error calling Authorize.Net: " +
        (err instanceof Error ? err.message : String(err)),
      json: null,
    };
  }

  let json: unknown;
  try {
    json = await parseAuthNetResponse(res);
  } catch {
    return { ok: false, message: "Invalid response from Authorize.Net", json: null };
  }

  const top = json as AuthNetMessages;
  if (top.messages?.resultCode === "Ok") {
    return { ok: true, json };
  }

  return {
    ok: false,
    message: extractErrorMessage(top, "Authorize.Net request failed"),
    json,
  };
}


// ─── Customer profiles ────────────────────────────────────────

export interface CreateCustomerProfileArgs {
  /** Our customer.id — used as merchantCustomerId (max 20 chars; truncated). */
  merchantCustomerId: string;
  description?: string;
  email?: string;
}

export interface CreateCustomerProfileResult {
  ok: boolean;
  customerProfileId?: string;
  /** True if Authorize.Net returned "duplicate profile" — caller should
   *  parse the existing id from `existingCustomerProfileId` and reuse it. */
  duplicate?: boolean;
  existingCustomerProfileId?: string;
  message: string;
  raw: unknown;
}

/**
 * Create a customer profile on Authorize.Net.
 *
 * If a profile with the same merchantCustomerId already exists, Authorize.Net
 * returns error code "E00039" with the existing customerProfileId in the text.
 * We surface that as `duplicate: true` + `existingCustomerProfileId` so the
 * caller can reuse it.
 */
export async function createCustomerProfile(
  credentials: AuthNetCredentials,
  args: CreateCustomerProfileArgs
): Promise<CreateCustomerProfileResult> {
  // merchantCustomerId is capped at 20 chars by Authorize.Net.
  const merchantCustomerId = args.merchantCustomerId.replace(/-/g, "").slice(0, 20);

  const body = {
    createCustomerProfileRequest: {
      merchantAuthentication: {
        name: credentials.apiLoginId,
        transactionKey: credentials.transactionKey,
      },
      profile: {
        merchantCustomerId,
        description: (args.description ?? "").slice(0, 255) || undefined,
        email: args.email || undefined,
      },
      validationMode: "none",
    },
  };

  const result = await postAuthNet(credentials, body);

  type Resp = AuthNetMessages & { customerProfileId?: string };
  const r = (result.json ?? {}) as Resp;

  if (result.ok) {
    return {
      ok: true,
      customerProfileId: r.customerProfileId,
      message: "Customer profile created",
      raw: result.json,
    };
  }

  // Duplicate profile? Pull the existing id out of the error text.
  // Format: "A duplicate record with ID <id> already exists."
  const errMsg = r.messages?.message?.[0];
  if (errMsg?.code === "E00039") {
    const match = (errMsg.text ?? "").match(/ID\s+(\d+)/i);
    if (match) {
      return {
        ok: false,
        duplicate: true,
        existingCustomerProfileId: match[1],
        message: errMsg.text ?? "Profile already exists",
        raw: result.json,
      };
    }
  }

  return {
    ok: false,
    message: result.message,
    raw: result.json,
  };
}


// ─── Payment profiles (cards on file) ─────────────────────────

export interface CreatePaymentProfileArgs {
  customerProfileId: string;
  opaqueData: { dataDescriptor: string; dataValue: string };
  /** Optional billing info — Authorize.Net likes a billTo on payment profiles. */
  billTo?: {
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  /** Mark this as the default payment method for the customer. */
  defaultPaymentProfile?: boolean;
}

export interface CreatePaymentProfileResult {
  ok: boolean;
  customerPaymentProfileId?: string;
  message: string;
  raw: unknown;
}

export async function createCustomerPaymentProfile(
  credentials: AuthNetCredentials,
  args: CreatePaymentProfileArgs
): Promise<CreatePaymentProfileResult> {
  const body = {
    createCustomerPaymentProfileRequest: {
      merchantAuthentication: {
        name: credentials.apiLoginId,
        transactionKey: credentials.transactionKey,
      },
      customerProfileId: args.customerProfileId,
      paymentProfile: {
        billTo: args.billTo,
        payment: { opaqueData: args.opaqueData },
        defaultPaymentProfile: args.defaultPaymentProfile ?? false,
      },
      // "none" — we'll exercise the card on the first real charge instead.
      validationMode: "none",
    },
  };

  const result = await postAuthNet(credentials, body);
  type Resp = AuthNetMessages & { customerPaymentProfileId?: string };
  const r = (result.json ?? {}) as Resp;

  if (result.ok) {
    return {
      ok: true,
      customerPaymentProfileId: r.customerPaymentProfileId,
      message: "Payment profile created",
      raw: result.json,
    };
  }

  return { ok: false, message: result.message, raw: result.json };
}


export interface PaymentProfileDetails {
  cardType?: string;
  cardLast4?: string;
}

/**
 * Fetch a saved payment profile to get the masked card details (last 4
 * + card type). Authorize.Net masks the expiration date as "XXXX" — if
 * the caller wants the real expiry they should capture it client-side
 * before tokenization and pass it through separately.
 */
export async function getCustomerPaymentProfile(
  credentials: AuthNetCredentials,
  customerProfileId: string,
  customerPaymentProfileId: string
): Promise<{ ok: boolean; details?: PaymentProfileDetails; message: string; raw: unknown }> {
  const body = {
    getCustomerPaymentProfileRequest: {
      merchantAuthentication: {
        name: credentials.apiLoginId,
        transactionKey: credentials.transactionKey,
      },
      customerProfileId,
      customerPaymentProfileId,
    },
  };

  const result = await postAuthNet(credentials, body);
  type Resp = AuthNetMessages & {
    paymentProfile?: {
      payment?: {
        creditCard?: { cardNumber?: string; cardType?: string };
      };
    };
  };
  const r = (result.json ?? {}) as Resp;

  if (!result.ok) {
    return { ok: false, message: result.message, raw: result.json };
  }

  const cc = r.paymentProfile?.payment?.creditCard;
  // Authorize.Net returns the PAN as "XXXX1111" — strip the X's for last 4.
  const last4 = cc?.cardNumber?.replace(/[^0-9]/g, "").slice(-4);

  return {
    ok: true,
    details: { cardType: cc?.cardType, cardLast4: last4 },
    message: "OK",
    raw: result.json,
  };
}


export async function deleteCustomerPaymentProfile(
  credentials: AuthNetCredentials,
  customerProfileId: string,
  customerPaymentProfileId: string
): Promise<{ ok: boolean; message: string; raw: unknown }> {
  const body = {
    deleteCustomerPaymentProfileRequest: {
      merchantAuthentication: {
        name: credentials.apiLoginId,
        transactionKey: credentials.transactionKey,
      },
      customerProfileId,
      customerPaymentProfileId,
    },
  };

  const result = await postAuthNet(credentials, body);
  return {
    ok: result.ok,
    message: result.ok ? "Payment profile deleted" : result.message,
    raw: result.json,
  };
}


// ─── Charging a saved card ────────────────────────────────────

export interface ChargeProfileArgs {
  customerProfileId: string;
  customerPaymentProfileId: string;
  amount: number;
  invoiceNumber?: string;
  description?: string;
}

/**
 * Charge a stored card by reference. Same response shape as chargeOpaqueCard.
 */
export async function chargeCustomerProfile(
  credentials: AuthNetCredentials,
  args: ChargeProfileArgs
): Promise<ChargeResult> {
  const body = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: credentials.apiLoginId,
        transactionKey: credentials.transactionKey,
      },
      refId: String(Date.now()).slice(-20),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: args.amount.toFixed(2),
        profile: {
          customerProfileId: args.customerProfileId,
          paymentProfile: { paymentProfileId: args.customerPaymentProfileId },
        },
        order: args.invoiceNumber
          ? {
              invoiceNumber: args.invoiceNumber.slice(0, 20),
              description: (args.description ?? "Customer payment").slice(0, 255),
            }
          : undefined,
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINTS[credentials.environment], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      message:
        "Network error calling Authorize.Net: " +
        (err instanceof Error ? err.message : String(err)),
      raw: null,
    };
  }

  let json: unknown;
  try {
    json = await parseAuthNetResponse(res);
  } catch {
    return { ok: false, message: "Invalid response from Authorize.Net", raw: null };
  }

  type Resp = {
    transactionResponse?: {
      responseCode?: string;
      transId?: string;
      authCode?: string;
      messages?: { message?: { description?: string }[] };
      errors?: { error?: { errorCode?: string; errorText?: string }[] };
    };
    messages?: { resultCode?: string; message?: { code?: string; text?: string }[] };
  };
  const r = json as Resp;
  const tr = r.transactionResponse;
  const respCode = tr?.responseCode;

  if (respCode === "1") {
    return {
      ok: true,
      transactionId: tr?.transId,
      authCode: tr?.authCode,
      responseCode: respCode,
      message: tr?.messages?.message?.[0]?.description ?? "Approved",
      raw: json,
    };
  }

  return {
    ok: false,
    transactionId: tr?.transId,
    responseCode: respCode,
    message:
      tr?.errors?.error?.[0]?.errorText ||
      r.messages?.message?.[0]?.text ||
      "Charge declined",
    raw: json,
  };
}
