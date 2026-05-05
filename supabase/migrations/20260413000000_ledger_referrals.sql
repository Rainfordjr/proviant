-- ============================================================
-- Full double-entry-style ledger + referral program.
--
-- Ledger entries track every financial event: charges,
-- payments, credits, adjustments, referral credits.
-- Running balance is derived from the sum of all entries.
--
-- Referral program: each org gets a unique referral code.
-- When a referred org pays an invoice, the referrer gets
-- a 10% credit on that paid amount.
-- ============================================================

-- 1. Ledger entries — the single source of truth for billing
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'charge',             -- subscription fee, proration charge, addon charge
    'payment',            -- payment received from customer
    'credit',             -- manual credit (goodwill, correction)
    'referral_credit',    -- automatic credit from referral program
    'adjustment',         -- manual adjustment (correction, write-off)
    'refund'              -- refund issued
  )),
  amount NUMERIC(10,2) NOT NULL,              -- positive = increases balance (charge), negative = decreases balance (payment/credit)
  running_balance NUMERIC(10,2),              -- computed on insert, snapshot of balance after this entry
  description TEXT NOT NULL,
  -- Links to related records
  invoice_id UUID REFERENCES billing_invoices(id),
  event_id UUID REFERENCES subscription_events(id),
  referral_id UUID,                           -- links to referrals table (added after table creation)
  -- Metadata
  reference_number TEXT,                      -- check number, transaction ID, etc.
  performed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_entries_org_read" ON ledger_entries
  FOR SELECT USING (org_id = public.user_org_id());

-- Index for fast balance lookups
CREATE INDEX idx_ledger_entries_org_created ON ledger_entries(org_id, created_at);

-- 2. Referral program
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referred_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  credit_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10,  -- 10% = 0.10
  total_credits_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_org_id)  -- each org can only be referred once
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_org_read" ON referrals
  FOR SELECT USING (
    referrer_org_id = public.user_org_id()
    OR referred_org_id = public.user_org_id()
  );

-- Add FK for ledger_entries.referral_id now that referrals exists
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_referral_fk
  FOREIGN KEY (referral_id) REFERENCES referrals(id);

-- 3. Add referral_code to organizations for easy lookup
ALTER TABLE organizations ADD COLUMN referral_code TEXT UNIQUE;

-- Generate a referral code for each existing org
-- Format: first 4 chars of org name (uppercase, no spaces) + random 4 digits
UPDATE organizations
SET referral_code = UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'), 4))
  || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
WHERE referral_code IS NULL;

-- 4. Add referred_by field to organizations for signup tracking
ALTER TABLE organizations ADD COLUMN referred_by UUID REFERENCES organizations(id);

-- 5. Helper function to get an org's current ledger balance
CREATE OR REPLACE FUNCTION org_ledger_balance(p_org_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM ledger_entries
  WHERE org_id = p_org_id;
$$ LANGUAGE SQL STABLE;

-- 6. Add billing-related permissions
INSERT INTO permissions (code, category, name, description) VALUES
  ('billing.ledger', 'Billing', 'View Ledger', 'View the full ledger of charges, payments, and credits');
