-- ============================================================
-- Proviant: Plugin / Module System
-- ============================================================
-- Modules are features that can be activated per-org.
-- Some are free (included), some are paid add-ons.

-- Master catalog of available modules (global, not per-org)
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,               -- e.g. 'inventory-mapping', 'lot-traceability'
  name TEXT NOT NULL,                       -- Display name
  description TEXT,
  category TEXT NOT NULL DEFAULT 'core',    -- core, operations, compliance, analytics, integrations
  icon TEXT,                                -- Lucide icon name
  is_free BOOLEAN NOT NULL DEFAULT true,
  price_monthly NUMERIC(10,2),             -- NULL or 0 for free modules
  price_yearly NUMERIC(10,2),
  is_core BOOLEAN NOT NULL DEFAULT false,  -- Core modules can't be deactivated
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-org module activations
CREATE TABLE org_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES users(id),
  UNIQUE(org_id, module_id)
);

CREATE INDEX idx_org_modules_org_id ON org_modules(org_id);
CREATE INDEX idx_org_modules_module_id ON org_modules(module_id);

-- RLS
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
-- Modules catalog is readable by everyone (it's a global catalog)
CREATE POLICY "Modules are globally readable" ON modules
  FOR SELECT USING (true);

ALTER TABLE org_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON org_modules
  FOR ALL USING (org_id = public.user_org_id());

-- Helper: check if the current user's org has a module activated
CREATE OR REPLACE FUNCTION public.org_has_module(module_slug TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_modules om
    JOIN modules m ON om.module_id = m.id
    WHERE om.org_id = public.user_org_id()
      AND m.slug = module_slug
      AND om.is_active = true
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Seed the module catalog with existing features + inventory mapping
INSERT INTO modules (slug, name, description, category, icon, is_free, is_core, sort_order) VALUES
  ('dashboard',          'Dashboard',              'Overview metrics and production insights',                    'core',        'LayoutDashboard', true,  true,  0),
  ('recipes',            'Recipe Management',      'Create, version, and approve recipes with ingredients',       'core',        'ChefHat',         true,  true,  10),
  ('products',           'Product Management',     'Manage finished products and hierarchies',                    'core',        'ShoppingBag',     true,  true,  20),
  ('batches',            'Batch Tracking',         'Track production batches with full traceability',             'core',        'Package',         true,  true,  30),
  ('materials',          'Raw Materials',          'Manage raw materials, suppliers, and lot tracking',           'core',        'Wheat',           true,  true,  40),
  ('orders',             'Order Management',       'Process customer orders and fulfillment',                     'operations',  'Truck',           true,  true,  50),
  ('customers',          'Customer Management',    'Manage customer contacts and order history',                  'operations',  'Users',           true,  true,  60),
  ('compliance',         'Compliance & HACCP',     'FDA compliance logging and HACCP plan management',            'compliance',  'ShieldCheck',     true,  true,  70),
  ('development',        'Product Development',    'R&D projects and test batch logging',                         'operations',  'FlaskConical',    true,  false, 80),
  ('inventory-mapping',  'Inventory Mapping',      'Visual warehouse maps with zones, racks, and bin locations',  'operations',  'Warehouse',       true,  false, 90),
  ('lot-traceability',   'Lot Traceability',       'Full forward and backward lot tracing for recalls',           'compliance',  'Search',          false, false, 100),
  ('analytics',          'Advanced Analytics',     'Custom reports, dashboards, and trend analysis',              'analytics',   'BarChart3',       false, false, 110),
  ('api-integrations',   'API Integrations',       'Connect to ERP, eCommerce, and shipping platforms',           'integrations','Plug',            false, false, 120);
