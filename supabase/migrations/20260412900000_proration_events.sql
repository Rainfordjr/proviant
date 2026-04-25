-- ============================================================
-- Subscription change events + proration support.
--
-- Every plan change (upgrade, downgrade, addon change) is
-- logged as an event. Prorated credits and charges are
-- calculated and recorded as line items on billing_invoices.
-- ============================================================

-- 1. Subscription events — immutable log of every change
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'plan_change', 'addon_added', 'addon_removed',
    'cycle_change', 'status_change', 'custom_rate_change',
    'trial_started', 'trial_ended', 'renewal'
  )),
  -- Snapshot of what changed
  previous_plan_id UUID REFERENCES plans(id),
  new_plan_id UUID REFERENCES plans(id),
  previous_plan_version_id UUID REFERENCES plan_versions(id),
  new_plan_version_id UUID REFERENCES plan_versions(id),
  addon_module_slug TEXT,                     -- for addon events
  previous_rate NUMERIC(10,2),
  new_rate NUMERIC(10,2),
  -- Proration details
  days_remaining INT,                         -- days left in period at time of change
  days_in_period INT,                         -- total days in current billing period
  credit_amount NUMERIC(10,2),                -- credit for unused days on old plan
  charge_amount NUMERIC(10,2),                -- charge for remaining days on new plan
  net_amount NUMERIC(10,2),                   -- charge_amount - credit_amount
  -- Metadata
  notes TEXT,
  performed_by UUID REFERENCES users(id),     -- who triggered the change
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_events_org_read" ON subscription_events
  FOR SELECT USING (org_id = public.user_org_id());

-- Service role handles inserts (bypasses RLS)

-- 2. Add invoice line items for detailed breakdowns
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  line_type TEXT NOT NULL CHECK (line_type IN ('plan', 'addon', 'credit', 'proration_credit', 'proration_charge', 'adjustment')),
  amount NUMERIC(10,2) NOT NULL,              -- negative for credits
  module_slug TEXT,                           -- for addon line items
  event_id UUID REFERENCES subscription_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_line_items_org_read" ON invoice_line_items
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM billing_invoices WHERE org_id = public.user_org_id())
  );
