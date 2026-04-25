-- ============================================================
-- Rework plans into global tiers + per-org add-on tracking.
--
-- Tiers are platform-level (not per-org). Each tier includes
-- a set of modules. Customers can add extra modules on top
-- for an additional per-module fee.
-- ============================================================

-- 1. Drop the old org-scoped plans and rebuild as global tiers
DROP POLICY IF EXISTS "plans_org_read" ON plans;
DROP POLICY IF EXISTS "plans_org_write" ON plans;

-- Remove org_id FK — plans are now global
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_org_id_fkey;
ALTER TABLE plans DROP COLUMN IF EXISTS org_id;

-- Add a tier-level flag and highlight color
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS badge TEXT;  -- e.g. "Most Popular", "Best Value"

-- Plans are now readable by everyone, writable by platform admins only (via service role)
CREATE POLICY "plans_read_all" ON plans FOR SELECT USING (true);

-- 2. Add-on modules per org subscription
-- Tracks extra modules a customer pays for beyond what their tier includes
CREATE TABLE subscription_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_slug TEXT NOT NULL REFERENCES modules(slug),
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  UNIQUE(org_id, module_slug)
);

ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addons_org_read" ON subscription_addons
  FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "addons_org_write" ON subscription_addons
  FOR ALL USING (org_id = public.user_org_id());

-- 3. Update module pricing for non-core, non-free modules
UPDATE modules SET price_monthly = 29.00, price_yearly = 290.00
  WHERE slug = 'development' AND (price_monthly IS NULL OR price_monthly = 0);

UPDATE modules SET price_monthly = 39.00, price_yearly = 390.00
  WHERE slug = 'inventory-mapping' AND (price_monthly IS NULL OR price_monthly = 0);

UPDATE modules SET price_monthly = 49.00, price_yearly = 490.00
  WHERE slug = 'lot-traceability' AND (price_monthly IS NULL OR price_monthly = 0);

UPDATE modules SET price_monthly = 59.00, price_yearly = 590.00
  WHERE slug = 'analytics' AND (price_monthly IS NULL OR price_monthly = 0);

UPDATE modules SET price_monthly = 39.00, price_yearly = 390.00
  WHERE slug = 'api-integrations' AND (price_monthly IS NULL OR price_monthly = 0);

-- 4. Seed default tiers
INSERT INTO plans (name, description, price_monthly, price_yearly, max_users, max_batches_per_month, included_modules, is_active, is_featured, badge, sort_order) VALUES
  (
    'Starter',
    'Perfect for small bakeries and food startups getting organized',
    49.00,
    490.00,
    5,
    50,
    ARRAY['dashboard','recipes','products','batches','materials','orders','customers','compliance'],
    true,
    false,
    NULL,
    0
  ),
  (
    'Professional',
    'For growing operations that need advanced tools and more capacity',
    149.00,
    1490.00,
    20,
    200,
    ARRAY['dashboard','recipes','products','batches','materials','orders','customers','compliance','development','inventory-mapping'],
    true,
    true,
    'Most Popular',
    10
  ),
  (
    'Enterprise',
    'Unlimited access with all modules and priority support',
    349.00,
    3490.00,
    NULL,
    NULL,
    ARRAY['dashboard','recipes','products','batches','materials','orders','customers','compliance','development','inventory-mapping','lot-traceability','analytics','api-integrations'],
    true,
    false,
    'All Inclusive',
    20
  );
