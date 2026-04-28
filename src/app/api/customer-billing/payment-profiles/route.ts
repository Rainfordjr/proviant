import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth, performedBy } from "@/lib/api-auth";
import { parseBody, uuid } from "@/lib/validation";
import {
  createCustomerProfile,
  createCustomerPaymentProfile,
  getCustomerPaymentProfile,
  deleteCustomerPaymentProfile,
} from "@/lib/gateways/auth-net";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/customer-billing/payment-profiles?customer_id=...
 *
 * List a customer's saved cards. Returns only the masked metadata —
 * full card details never leave Authorize.Net.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "customer_billing.view");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer_id");
  if (!customerId) {
    return NextResponse.json(
      { error: "customer_id query param is required" },
      { status: 400 }
    );
  }

  const admin = createAdmin();
  const { data, error } = await admin
    .from("customer_payment_profiles")
    .select(
      "id, customer_id, gateway, card_type, card_last4, card_exp_month, card_exp_year, cardholder_name, is_default, created_at"
    )
    .eq("org_id", auth.org_id)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}


const CreateSchema = z.object({
  customer_id: uuid(),
  opaque_data: z.object({
    dataDescriptor: z.string().min(1),
    dataValue: z.string().min(1),
  }),
  /** Last 4 of PAN — captured client-side before tokenization. We'll
   *  re-verify against Authorize.Net after the profile is created. */
  card_last4: z.string().regex(/^\d{4}$/),
  /** "MM" — informational; Authorize.Net masks this on retrieval. */
  card_exp_month: z.string().regex(/^\d{1,2}$/).optional(),
  /** "YYYY" — same. */
  card_exp_year: z.string().regex(/^\d{2,4}$/).optional(),
  cardholder_name: z.string().optional().nullable(),
  /** Optional billing details for AVS — improves card success rates. */
  billing_zip: z.string().optional().nullable(),
  is_default: z.boolean().optional().default(false),
});

/**
 * POST /api/customer-billing/payment-profiles
 *
 * Save a card on file via Authorize.Net CIM.
 *
 * Flow:
 *   1. Ensure the customer has an Authorize.Net customer profile
 *      (create it via createCustomerProfileRequest if missing).
 *   2. Add the card as a payment profile (uses the Accept.js opaque token).
 *   3. Look up the saved profile to get authoritative card_last4 / card_type.
 *   4. Insert a row into customer_payment_profiles.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "customer_billing.manage");
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, CreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const admin = createAdmin();

  // Tenant-check the customer; also we need their email/name for the profile.
  const { data: customer } = await admin
    .from("customers")
    .select(
      "id, org_id, name, email, contact_name, auth_net_customer_profile_id"
    )
    .eq("id", body.customer_id)
    .single();
  if (!customer || customer.org_id !== auth.org_id) {
    return NextResponse.json(
      { error: "Customer not found in your organization" },
      { status: 404 }
    );
  }

  // Look up the org's Authorize.Net credentials.
  const { data: gateways } = await admin
    .from("org_payment_gateways")
    .select(
      "auth_net_environment, auth_net_api_login_id, auth_net_transaction_key"
    )
    .eq("org_id", auth.org_id)
    .maybeSingle();
  if (
    !gateways?.auth_net_api_login_id ||
    !gateways?.auth_net_transaction_key
  ) {
    return NextResponse.json(
      {
        error:
          "Authorize.Net is not configured. Visit Settings → Payment Gateways to add credentials.",
      },
      { status: 400 }
    );
  }
  const credentials = {
    environment: gateways.auth_net_environment as "sandbox" | "production",
    apiLoginId: gateways.auth_net_api_login_id,
    transactionKey: gateways.auth_net_transaction_key,
  };

  // 1. Get-or-create the customer profile on Authorize.Net.
  let customerProfileId = customer.auth_net_customer_profile_id;
  if (!customerProfileId) {
    const created = await createCustomerProfile(credentials, {
      merchantCustomerId: customer.id,
      description: customer.name,
      email: customer.email ?? undefined,
    });
    if (created.ok && created.customerProfileId) {
      customerProfileId = created.customerProfileId;
    } else if (created.duplicate && created.existingCustomerProfileId) {
      // Authorize.Net says we already have a profile for this merchantCustomerId
      // even though our DB doesn't know about it — adopt the existing one.
      customerProfileId = created.existingCustomerProfileId;
    } else {
      return NextResponse.json(
        {
          error:
            "Failed to create Authorize.Net customer profile: " + created.message,
        },
        { status: 502 }
      );
    }

    // Persist the new profile id on our customer row.
    await admin
      .from("customers")
      .update({ auth_net_customer_profile_id: customerProfileId })
      .eq("id", customer.id);
  }

  // 2. Add the card as a payment profile.
  const billTo = {
    firstName: customer.contact_name?.split(" ")[0] ?? customer.name.split(" ")[0],
    lastName:
      customer.contact_name?.split(" ").slice(1).join(" ") ||
      customer.name.split(" ").slice(1).join(" "),
    zip: body.billing_zip ?? undefined,
    country: "US",
  };

  const created = await createCustomerPaymentProfile(credentials, {
    customerProfileId,
    opaqueData: body.opaque_data,
    billTo,
    defaultPaymentProfile: body.is_default,
  });

  if (!created.ok || !created.customerPaymentProfileId) {
    return NextResponse.json(
      { error: "Failed to save card: " + created.message },
      { status: 502 }
    );
  }

  // 3. Verify by fetching the masked details Authorize.Net stored.
  const verified = await getCustomerPaymentProfile(
    credentials,
    customerProfileId,
    created.customerPaymentProfileId
  );

  // If verification fails we still saved the card — soldier on with what
  // the client gave us; it's an authoritative-vs-eventually-consistent
  // trade-off and we already have the card on file.
  const cardType = verified.details?.cardType ?? null;
  const cardLast4 = verified.details?.cardLast4 ?? body.card_last4;

  // 4. Persist on our side. If we're saving as default, clear other defaults
  //    for this customer first.
  if (body.is_default) {
    await admin
      .from("customer_payment_profiles")
      .update({ is_default: false })
      .eq("customer_id", customer.id);
  }

  const { data: row, error: insertErr } = await admin
    .from("customer_payment_profiles")
    .insert({
      org_id: auth.org_id,
      customer_id: customer.id,
      gateway: "authorize_net",
      gateway_customer_id: customerProfileId,
      gateway_payment_profile_id: created.customerPaymentProfileId,
      card_type: cardType,
      card_last4: cardLast4,
      card_exp_month: body.card_exp_month ?? null,
      card_exp_year: body.card_exp_year ?? null,
      cardholder_name: body.cardholder_name ?? null,
      is_default: body.is_default ?? false,
      created_by: performedBy(auth),
    })
    .select(
      "id, customer_id, gateway, card_type, card_last4, card_exp_month, card_exp_year, cardholder_name, is_default, created_at"
    )
    .single();

  if (insertErr) {
    // Card is saved on Authorize.Net but we can't track it locally.
    // Best-effort cleanup so we don't leave orphans.
    await deleteCustomerPaymentProfile(
      credentials,
      customerProfileId,
      created.customerPaymentProfileId
    ).catch(() => {});
    return NextResponse.json(
      {
        error:
          "Card saved on gateway but failed to record locally: " +
          insertErr.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: row }, { status: 201 });
}
