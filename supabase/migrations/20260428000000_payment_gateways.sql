-- ============================================================
-- Per-tenant payment gateway credentials + payment status fields
-- to support online card payments (Authorize.Net) and ACH
-- transfers (Bill.com), in addition to the existing manual
-- check/cash/ACH/card recording flows.
--
-- SECURITY NOTE
-- The credential columns below store API keys and shared secrets
-- as plain TEXT for v1. Before going to production, migrate these
-- to Supabase Vault (or wrap with pgsodium) so they're encrypted
-- at rest. The table-level grants here lock direct read/write to
-- service_role only — the API routes are the only path in.
-- ============================================================


-- 1. org_payment_gateways -------------------------------------
-- One row per tenant org. NULL columns = "not configured" for
-- that gateway. Keeping a single row per org (rather than one row
-- per gateway) makes the settings UI simpler.

CREATE TABLE org_payment_gateways (
  org_id                       UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Authorize.Net (cards)
  auth_net_environment         TEXT CHECK (auth_net_environment IN ('sandbox', 'production')),
  auth_net_api_login_id        TEXT,                    -- secret
  auth_net_transaction_key     TEXT,                    -- secret
  auth_net_public_client_key   TEXT,                    -- safe to expose to the browser (used by Accept.js)

  -- Bill.com (ACH)
  bill_dot_com_environment     TEXT CHECK (bill_dot_com_environment IN ('sandbox', 'production')),
  bill_dot_com_dev_key         TEXT,                    -- secret (developer key)
  bill_dot_com_username        TEXT,
  bill_dot_com_password        TEXT,                    -- secret
  bill_dot_com_org_id          TEXT,                    -- Bill.com's internal org id, returned on first login

  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                   UUID REFERENCES users(id)
);

ALTER TABLE org_payment_gateways ENABLE ROW LEVEL SECURITY;
-- No RLS policies: service-role-only access via API routes (see GRANT below).
REVOKE ALL ON TABLE org_payment_gateways FROM PUBLIC, anon, authenticated;
GRANT  ALL ON TABLE org_payment_gateways TO   service_role;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON org_payment_gateways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 2. Augment customer_payments with gateway tracking ----------
--
-- gateway          NULL for manual entries (check / cash / etc.)
--                  'authorize_net' for card charges
--                  'bill_dot_com' for ACH initiated through Bill.com
--
-- gateway_status   'cleared' for instant settlement (cards, manual)
--                  'pending' for in-flight settlement (ACH typically)
--                  'failed'  if the gateway rejected
--                  'refunded' if reversed
--
-- Pending payments still count toward the customer's balance
-- (the convention in our customer_balance() function), since the
-- customer has authorized; if the ACH bounces we'd record a
-- compensating reversal.

ALTER TABLE customer_payments
  ADD COLUMN gateway                TEXT,
  ADD COLUMN gateway_transaction_id TEXT,
  ADD COLUMN gateway_status         TEXT NOT NULL DEFAULT 'cleared',
  ADD COLUMN gateway_metadata       JSONB;

ALTER TABLE customer_payments
  ADD CONSTRAINT customer_payments_gateway_chk
    CHECK (gateway IS NULL OR gateway IN ('authorize_net', 'bill_dot_com'));

ALTER TABLE customer_payments
  ADD CONSTRAINT customer_payments_gateway_status_chk
    CHECK (gateway_status IN ('cleared', 'pending', 'failed', 'refunded'));

CREATE INDEX idx_customer_payments_gateway_txn
  ON customer_payments(gateway, gateway_transaction_id);


-- 3. customer_unapplied_credit() helper -----------------------
-- Sum of payment amounts that haven't been allocated to any
-- invoice yet. This is the "credit available" on a customer's
-- account that can still be applied to future invoices.

CREATE OR REPLACE FUNCTION customer_unapplied_credit(p_customer_id UUID)
RETURNS NUMERIC AS $$
  SELECT GREATEST(0,
    COALESCE((
      SELECT SUM(amount) FROM customer_payments
       WHERE customer_id = p_customer_id
         AND gateway_status IN ('cleared', 'pending')
    ), 0)
    -
    COALESCE((
      SELECT SUM(app.amount)
        FROM customer_payment_applications app
        JOIN customer_payments p ON p.id = app.payment_id
       WHERE p.customer_id = p_customer_id
         AND p.gateway_status IN ('cleared', 'pending')
    ), 0)
  );
$$ LANGUAGE SQL STABLE;
