-- ============================================================
-- Subscription-based billing: plans + org subscriptions
-- Supports predefined tiers AND custom flat-rate overrides.
-- No payment processing — just accounting/tracking.
-- ============================================================

-- 1. Plans (predefined tiers)
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- e.g. "Starter", "Pro", "Enterprise"
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2),                  -- optional annual discount
  max_users INT,                               -- null = unlimited
  max_batches_per_month INT,                   -- null = unlimited
  included_modules TEXT[] DEFAULT '{}',        -- array of module slugs included in this plan
  is_active BOOLEAN NOT NULL DEFAULT true,     -- can be deactivated without deleting
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_org_read" ON plans
  FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "plans_org_write" ON plans
  FOR ALL USING (org_id = public.user_org_id());

-- 2. Org subscriptions (what plan each customer-org is on)
CREATE TABLE org_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id),           -- null if using a custom flat rate
  billing_type TEXT NOT NULL DEFAULT 'plan' CHECK (billing_type IN ('plan', 'custom')),
  custom_rate_monthly NUMERIC(10,2),           -- used when billing_type = 'custom'
  custom_rate_yearly NUMERIC(10,2),
  custom_notes TEXT,                           -- admin notes for custom deals
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'past_due', 'cancelled', 'suspended')),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 month'),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_subscriptions_org_read" ON org_subscriptions
  FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "org_subscriptions_org_write" ON org_subscriptions
  FOR ALL USING (org_id = public.user_org_id());

-- 3. Billing history / invoice ledger (for record keeping)
CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'void')),
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_invoices_org_read" ON billing_invoices
  FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "billing_invoices_org_write" ON billing_invoices
  FOR ALL USING (org_id = public.user_org_id());

-- 4. Add billing permissions
INSERT INTO permissions (code, category, name, description) VALUES
  ('billing.view',   'Billing', 'View Billing',   'View subscription plan and invoice history'),
  ('billing.manage', 'Billing', 'Manage Billing',  'Change plans and manage billing settings');
