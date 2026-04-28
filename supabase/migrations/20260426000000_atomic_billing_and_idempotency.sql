-- ============================================================
-- Atomic billing operations + request idempotency.
--
-- Two financial routes (/api/billing/change-plan and
-- /api/admin/record-payment) previously did multiple writes
-- back-to-back. A failure mid-sequence left the org in an
-- inconsistent state (logged event but no invoice, payment
-- recorded but referral credit missing, etc.).
--
-- This migration adds:
--   1. idempotency_keys: dedup table for client-supplied keys.
--   2. apply_plan_change(): single-transaction version of the
--      change-plan write sequence.
--   3. record_payment_with_referral(): single-transaction
--      version of the record-payment write sequence.
--
-- Both functions are SECURITY INVOKER and locked to service_role.
-- ============================================================


-- 1. Idempotency keys ----------------------------------------

CREATE TABLE idempotency_keys (
  scope         TEXT NOT NULL,
  key           TEXT NOT NULL,
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  status_code   INTEGER NOT NULL,         -- 0 = in flight, otherwise final HTTP status
  response      JSONB,                    -- final response body; null while in flight
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  PRIMARY KEY (scope, key)
);

CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys(created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
-- No policies: service role only (bypasses RLS).

REVOKE ALL ON TABLE idempotency_keys FROM PUBLIC, anon, authenticated;
GRANT  ALL ON TABLE idempotency_keys TO   service_role;


-- 2. apply_plan_change() -------------------------------------
--
-- Performs all four writes from the change-plan route in one
-- transaction:
--   a. Insert subscription_events row.
--   b. (If net != 0) insert billing_invoices + invoice_line_items.
--   c. Update or insert org_subscriptions.
--
-- Proration math is done in TS and passed in. Returns
-- { event_id, invoice_id } as JSONB so the API can echo
-- the ids without re-querying.

CREATE OR REPLACE FUNCTION apply_plan_change(
  p_org_id              UUID,
  p_subscription_id     UUID,           -- null = no existing sub; insert one
  p_old_plan_id         UUID,
  p_new_plan_id         UUID,
  p_old_version_id      UUID,
  p_new_version_id      UUID,
  p_old_rate            NUMERIC,
  p_new_rate            NUMERIC,
  p_old_plan_name       TEXT,
  p_new_plan_name       TEXT,
  p_days_remaining      INTEGER,
  p_days_in_period      INTEGER,
  p_credit_amount       NUMERIC,
  p_charge_amount       NUMERIC,
  p_net_amount          NUMERIC,
  p_current_period_end  TIMESTAMPTZ,    -- null when there's no existing sub
  p_keep_trial          BOOLEAN,
  p_performed_by        UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id   UUID;
  v_invoice_id UUID;
  v_now        TIMESTAMPTZ := now();
BEGIN
  -- (a) Subscription event log
  INSERT INTO subscription_events (
    org_id, event_type,
    previous_plan_id, new_plan_id,
    previous_plan_version_id, new_plan_version_id,
    previous_rate, new_rate,
    days_remaining, days_in_period,
    credit_amount, charge_amount, net_amount,
    performed_by, notes
  ) VALUES (
    p_org_id, 'plan_change',
    p_old_plan_id, p_new_plan_id,
    p_old_version_id, p_new_version_id,
    p_old_rate, p_new_rate,
    p_days_remaining, p_days_in_period,
    COALESCE(p_credit_amount, 0),
    COALESCE(p_charge_amount, 0),
    COALESCE(p_net_amount, 0),
    p_performed_by,
    CASE
      WHEN p_days_remaining IS NOT NULL THEN format(
        'Prorated: %s days remaining. Credit $%s, Charge $%s, Net $%s',
        p_days_remaining,
        to_char(COALESCE(p_credit_amount, 0), 'FM999999990.00'),
        to_char(COALESCE(p_charge_amount, 0), 'FM999999990.00'),
        to_char(COALESCE(p_net_amount,    0), 'FM999999990.00')
      )
      ELSE 'Initial plan selection'
    END
  )
  RETURNING id INTO v_event_id;

  -- (b) Prorated invoice + line items (only when there's a non-zero net)
  IF p_net_amount IS NOT NULL AND p_net_amount <> 0 THEN
    INSERT INTO billing_invoices (
      org_id, period_start, period_end, amount, status, description
    ) VALUES (
      p_org_id,
      v_now,
      p_current_period_end,
      p_net_amount,
      CASE WHEN p_net_amount > 0 THEN 'pending' ELSE 'paid' END,
      format('Plan change proration: %s → %s',
             COALESCE(p_old_plan_name, 'Previous'),
             p_new_plan_name)
    )
    RETURNING id INTO v_invoice_id;

    IF p_credit_amount IS NOT NULL AND p_credit_amount > 0 THEN
      INSERT INTO invoice_line_items (
        invoice_id, description, line_type, amount, event_id
      ) VALUES (
        v_invoice_id,
        format('Credit: unused %s days on %s ($%s/mo)',
               p_days_remaining,
               COALESCE(p_old_plan_name, 'previous plan'),
               to_char(p_old_rate, 'FM999999990.00')),
        'proration_credit',
        -p_credit_amount,
        v_event_id
      );
    END IF;

    IF p_charge_amount IS NOT NULL AND p_charge_amount > 0 THEN
      INSERT INTO invoice_line_items (
        invoice_id, description, line_type, amount, event_id
      ) VALUES (
        v_invoice_id,
        format('Charge: %s days on %s ($%s/mo)',
               p_days_remaining,
               p_new_plan_name,
               to_char(p_new_rate, 'FM999999990.00')),
        'proration_charge',
        p_charge_amount,
        v_event_id
      );
    END IF;
  END IF;

  -- (c) Update or create the subscription row
  IF p_subscription_id IS NOT NULL THEN
    UPDATE org_subscriptions
       SET plan_id          = p_new_plan_id,
           plan_version_id  = p_new_version_id,
           billing_type     = 'plan',
           status           = CASE WHEN p_keep_trial THEN 'trial' ELSE 'active' END,
           updated_at       = v_now
     WHERE id = p_subscription_id;
  ELSE
    INSERT INTO org_subscriptions (
      org_id, plan_id, plan_version_id,
      billing_type, billing_cycle, status,
      current_period_start, current_period_end
    ) VALUES (
      p_org_id, p_new_plan_id, p_new_version_id,
      'plan', 'monthly', 'active',
      v_now, v_now + INTERVAL '1 month'
    );
  END IF;

  RETURN jsonb_build_object(
    'event_id',   v_event_id,
    'invoice_id', v_invoice_id
  );
END;
$$;

REVOKE ALL ON FUNCTION apply_plan_change(
  UUID, UUID, UUID, UUID, UUID, UUID,
  NUMERIC, NUMERIC, TEXT, TEXT,
  INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC,
  TIMESTAMPTZ, BOOLEAN, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION apply_plan_change(
  UUID, UUID, UUID, UUID, UUID, UUID,
  NUMERIC, NUMERIC, TEXT, TEXT,
  INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC,
  TIMESTAMPTZ, BOOLEAN, UUID
) TO service_role;


-- 3. record_payment_with_referral() --------------------------
--
-- Performs all writes from the record-payment route in one
-- transaction:
--   a. Insert payment ledger entry (org_id, amount = -|amount|).
--   b. Mark linked invoice as paid (if invoice_id given).
--   c. If org has an active referral, insert a referral_credit
--      ledger entry on the referrer + bump total_credits_earned.
--
-- Returns { payment_id, balance, referral_credit } as JSONB.

CREATE OR REPLACE FUNCTION record_payment_with_referral(
  p_org_id           UUID,
  p_amount           NUMERIC,           -- positive: amount paid by customer
  p_description      TEXT,
  p_reference_number TEXT,
  p_notes            TEXT,
  p_invoice_id       UUID,
  p_performed_by     UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_amount     NUMERIC;
  v_current_balance    NUMERIC;
  v_new_balance        NUMERIC;
  v_payment_id         UUID;
  v_referral           referrals%ROWTYPE;
  v_credit_amount      NUMERIC;
  v_ref_balance        NUMERIC;
  v_ref_new_balance    NUMERIC;
  v_credit_entry_id    UUID;
  v_referral_response  JSONB := NULL;
BEGIN
  v_payment_amount := -ABS(p_amount);

  -- (a) Payment ledger entry on the paying org
  v_current_balance := COALESCE(org_ledger_balance(p_org_id), 0);
  v_new_balance     := round(v_current_balance + v_payment_amount, 2);

  INSERT INTO ledger_entries (
    org_id, entry_type, amount, running_balance, description,
    reference_number, notes, invoice_id, performed_by
  ) VALUES (
    p_org_id, 'payment', v_payment_amount, v_new_balance, p_description,
    p_reference_number, p_notes, p_invoice_id, p_performed_by
  )
  RETURNING id INTO v_payment_id;

  -- (b) Mark invoice paid if one was linked
  IF p_invoice_id IS NOT NULL THEN
    UPDATE billing_invoices
       SET status  = 'paid',
           paid_at = now()
     WHERE id = p_invoice_id;
  END IF;

  -- (c) Apply referral credit on the referrer's ledger, if any
  SELECT * INTO v_referral
    FROM referrals
   WHERE referred_org_id = p_org_id
     AND status = 'active'
   LIMIT 1;

  IF FOUND THEN
    v_credit_amount := round(ABS(p_amount) * v_referral.credit_rate, 2);

    IF v_credit_amount > 0 THEN
      v_ref_balance     := COALESCE(org_ledger_balance(v_referral.referrer_org_id), 0);
      v_ref_new_balance := round(v_ref_balance + (-v_credit_amount), 2);

      INSERT INTO ledger_entries (
        org_id, entry_type, amount, running_balance, description,
        referral_id, performed_by
      ) VALUES (
        v_referral.referrer_org_id,
        'referral_credit',
        -v_credit_amount,
        v_ref_new_balance,
        'Referral credit: 10% of payment from referred organization',
        v_referral.id,
        p_performed_by
      )
      RETURNING id INTO v_credit_entry_id;

      UPDATE referrals
         SET total_credits_earned = total_credits_earned + v_credit_amount
       WHERE id = v_referral.id;

      v_referral_response := jsonb_build_object(
        'referrer_org_id', v_referral.referrer_org_id,
        'credit_amount',   v_credit_amount,
        'credit_entry_id', v_credit_entry_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'payment_id',      v_payment_id,
    'balance',         v_new_balance,
    'referral_credit', v_referral_response
  );
END;
$$;

REVOKE ALL ON FUNCTION record_payment_with_referral(
  UUID, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION record_payment_with_referral(
  UUID, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID
) TO service_role;
