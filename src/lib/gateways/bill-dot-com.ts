/**
 * Server-side Bill.com client (stub for v1).
 *
 * Bill.com's product is built around back-office accounting / outbound
 * bill-pay rather than as a drop-in incoming-ACH processor. To accept
 * customer ACH payments through them you typically need to:
 *
 *   1. Sync the customer to Bill.com as a Customer record.
 *   2. Sync the invoice (or create one in Bill.com) so a payment can
 *      be requested against it.
 *   3. Have the customer authorize the bank account on file via
 *      Bill.com's portal (or you collect routing/account and call the
 *      MFA-protected `Crud/Create/CustomerBankAccount.json` endpoint).
 *   4. Initiate a charge with `ChargeCustomer.json`.
 *   5. Listen for settlement webhooks (or poll) — ACH typically settles
 *      in 3-5 business days.
 *
 * The right shape for steps 1-3 depends on whether the user wants their
 * customers to log in to a Bill.com-hosted portal, or whether the
 * Proviant tenant collects bank info themselves. That UX decision needs
 * to be made before this stub is fleshed out.
 *
 * For now the v1 flow:
 *   - Captures routing/account from the user
 *   - Records a `customer_payments` row with gateway='bill_dot_com',
 *     gateway_status='pending', and the bank info in `gateway_metadata`
 *   - Returns success so the rest of the system behaves as if the ACH
 *     is in flight; settlement can be marked manually by editing the row
 *     until the real Bill.com calls are wired
 */

export interface BillDotComCredentials {
  environment: "sandbox" | "production";
  devKey: string;
  username: string;
  password: string;
  orgId: string;
}

export interface InitiateAchArgs {
  amount: number;
  routingNumber: string;
  accountNumber: string;
  accountHolderName: string;
  accountType: "checking" | "savings";
  description?: string;
}

export interface InitiateAchResult {
  ok: boolean;
  transactionId?: string;
  status: "pending" | "failed";
  message: string;
  raw: unknown;
}

/**
 * Initiate an ACH transfer through Bill.com.
 *
 * STUB: returns a synthetic pending transaction id and stashes the bank
 * info in `raw` so the caller can persist it as `gateway_metadata` for
 * later reference. Replace the body with the real Bill.com REST calls
 * once the design questions in the file header are settled.
 */
export async function initiateAchTransfer(
  credentials: BillDotComCredentials,
  args: InitiateAchArgs
): Promise<InitiateAchResult> {
  if (!credentials.devKey || !credentials.username || !credentials.password) {
    return {
      ok: false,
      status: "failed",
      message: "Bill.com is not configured for this organization.",
      raw: null,
    };
  }

  // ─── TODO: real Bill.com API call ──────────────────────────────────
  // 1. POST /api/v3/Login.json with devKey + userName + password to get sessionId
  // 2. Look up or create a CustomerBankAccount with routing/account
  // 3. Call ChargeCustomer.json with the customerId and bank account id
  // 4. Return the resulting transaction id
  //
  // For now we return a pending placeholder so the rest of the system
  // works. When the real call is wired, return the real transaction id
  // and let the settlement webhook flip gateway_status to 'cleared'.
  // ───────────────────────────────────────────────────────────────────

  const placeholderTxnId =
    "bdc-pending-" + Math.random().toString(36).slice(2, 12);

  return {
    ok: true,
    transactionId: placeholderTxnId,
    status: "pending",
    message:
      "ACH transfer recorded as pending. Bill.com submission is not yet wired — settle manually when funds clear.",
    raw: {
      // Stored in gateway_metadata so the bank info is available for
      // troubleshooting until the real integration lands. Mask the
      // account number except for the last 4.
      account_last4: args.accountNumber.slice(-4),
      routing_number: args.routingNumber,
      account_holder_name: args.accountHolderName,
      account_type: args.accountType,
      submitted_at: new Date().toISOString(),
    },
  };
}
