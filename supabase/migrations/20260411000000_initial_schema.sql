-- ============================================================
-- Proviant: Food Manufacturing SaaS - Initial Schema
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ORGANIZATIONS (tenants)
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'starter', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. USERS (linked to Supabase Auth)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'manager', 'operator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_org_id ON users(org_id);

-- ============================================================
-- 3. PRODUCTS
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  unit TEXT NOT NULL DEFAULT 'units',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, sku)
);

CREATE INDEX idx_products_org_id ON products(org_id);

-- ============================================================
-- 4. SUPPLIERS
-- ============================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_org_id ON suppliers(org_id);

-- ============================================================
-- 5. RAW MATERIALS
-- ============================================================
CREATE TABLE raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'lbs',
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_raw_materials_org_id ON raw_materials(org_id);
CREATE INDEX idx_raw_materials_supplier_id ON raw_materials(supplier_id);

-- ============================================================
-- 6. MATERIAL LOTS (incoming ingredient lots)
-- ============================================================
CREATE TABLE material_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  quantity_remaining NUMERIC NOT NULL,
  expiry_date DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  supplier_lot_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_material_lots_material_id ON material_lots(material_id);
CREATE INDEX idx_material_lots_expiry_date ON material_lots(expiry_date);

-- ============================================================
-- 7. BATCHES (production runs)
-- ============================================================
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'on_hold', 'rejected')),
  quantity_produced NUMERIC,
  produced_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, batch_number)
);

CREATE INDEX idx_batches_org_id ON batches(org_id);
CREATE INDEX idx_batches_product_id ON batches(product_id);
CREATE INDEX idx_batches_status ON batches(status);

-- ============================================================
-- 8. BATCH INGREDIENTS (traceability link)
-- ============================================================
CREATE TABLE batch_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  material_lot_id UUID NOT NULL REFERENCES material_lots(id) ON DELETE RESTRICT,
  quantity_used NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_batch_ingredients_batch_id ON batch_ingredients(batch_id);
CREATE INDEX idx_batch_ingredients_material_lot_id ON batch_ingredients(material_lot_id);

-- ============================================================
-- 9. COMPLIANCE LOGS
-- ============================================================
CREATE TABLE compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('temperature', 'sanitation', 'allergen', 'ccp', 'other')),
  ccp_id TEXT,
  value TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_logs_org_id ON compliance_logs(org_id);
CREATE INDEX idx_compliance_logs_type ON compliance_logs(type);
CREATE INDEX idx_compliance_logs_recorded_at ON compliance_logs(recorded_at);

-- ============================================================
-- 10. HACCP PLANS
-- ============================================================
CREATE TABLE haccp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_plans_org_id ON haccp_plans(org_id);

-- ============================================================
-- 11. HACCP CRITICAL CONTROL POINTS
-- ============================================================
CREATE TABLE haccp_ccps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES haccp_plans(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  hazard TEXT NOT NULL,
  critical_limit TEXT NOT NULL,
  monitoring_procedure TEXT NOT NULL,
  corrective_action TEXT NOT NULL,
  verification TEXT,
  record_keeping TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_ccps_plan_id ON haccp_ccps(plan_id);

-- ============================================================
-- 12. ORDERS
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shipped_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, order_number)
);

CREATE INDEX idx_orders_org_id ON orders(org_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ============================================================
-- 13. ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- 14. PURCHASE ORDERS (for raw materials)
-- ============================================================
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'received', 'cancelled')),
  ordered_at TIMESTAMPTZ,
  expected_at DATE,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, po_number)
);

CREATE INDEX idx_purchase_orders_org_id ON purchase_orders(org_id);

-- ============================================================
-- 15. PURCHASE ORDER ITEMS
-- ============================================================
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity_ordered NUMERIC NOT NULL,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);


-- ============================================================
-- ROW LEVEL SECURITY (multi-tenancy)
-- ============================================================
-- Helper function: get the current user's org_id
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_ccps ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Organizations: users can only see their own org
CREATE POLICY "Users can view own org" ON organizations
  FOR SELECT USING (id = public.user_org_id());

-- Users: can see teammates in same org
CREATE POLICY "Users can view org members" ON users
  FOR SELECT USING (org_id = public.user_org_id());

-- Generic tenant isolation policy for all data tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'products', 'suppliers', 'raw_materials', 'batches',
      'compliance_logs', 'haccp_plans', 'orders', 'purchase_orders'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY "Tenant isolation" ON %I FOR ALL USING (org_id = public.user_org_id())',
      tbl
    );
  END LOOP;
END $$;

-- Child tables: access through parent's tenant check
CREATE POLICY "Access via parent" ON material_lots
  FOR ALL USING (
    material_id IN (SELECT id FROM raw_materials WHERE org_id = public.user_org_id())
  );

CREATE POLICY "Access via parent" ON batch_ingredients
  FOR ALL USING (
    batch_id IN (SELECT id FROM batches WHERE org_id = public.user_org_id())
  );

CREATE POLICY "Access via parent" ON haccp_ccps
  FOR ALL USING (
    plan_id IN (SELECT id FROM haccp_plans WHERE org_id = public.user_org_id())
  );

CREATE POLICY "Access via parent" ON order_items
  FOR ALL USING (
    order_id IN (SELECT id FROM orders WHERE org_id = public.user_org_id())
  );

CREATE POLICY "Access via parent" ON purchase_order_items
  FOR ALL USING (
    purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id = public.user_org_id())
  );


-- ============================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'organizations', 'products', 'suppliers', 'raw_materials',
      'batches', 'haccp_plans', 'orders', 'purchase_orders'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      tbl
    );
  END LOOP;
END $$;


-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Batch detail with product name and ingredient count
CREATE VIEW batch_details AS
SELECT
  b.*,
  p.name AS product_name,
  p.sku AS product_sku,
  COUNT(bi.id) AS ingredient_count
FROM batches b
JOIN products p ON b.product_id = p.id
LEFT JOIN batch_ingredients bi ON b.id = bi.batch_id
GROUP BY b.id, p.name, p.sku;

-- Low stock materials
CREATE VIEW low_stock_materials AS
SELECT
  rm.*,
  s.name AS supplier_name
FROM raw_materials rm
LEFT JOIN suppliers s ON rm.supplier_id = s.id
WHERE rm.current_stock <= rm.reorder_point
  AND rm.is_active = true;

-- Expiring lots (within 30 days)
CREATE VIEW expiring_lots AS
SELECT
  ml.*,
  rm.name AS material_name,
  rm.org_id
FROM material_lots ml
JOIN raw_materials rm ON ml.material_id = rm.id
WHERE ml.expiry_date IS NOT NULL
  AND ml.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
  AND ml.quantity_remaining > 0;
