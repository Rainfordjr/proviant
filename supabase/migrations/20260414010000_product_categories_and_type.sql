-- ============================================================
-- Product categories (user-managed) and product_type flag
-- ============================================================

-- 1. Product categories table
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_product_categories_org_id ON product_categories(org_id);

-- RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON product_categories
  FOR ALL USING (org_id = public.user_org_id());

-- 2. Add product_type to products (production vs distribution)
ALTER TABLE products
  ADD COLUMN product_type TEXT NOT NULL DEFAULT 'production'
    CHECK (product_type IN ('production', 'distribution'));

COMMENT ON COLUMN products.product_type IS 'production = manufactured in-house, distribution = resold from a supplier';

-- 3. Add category_id FK to products (nullable for backward compat during transition)
ALTER TABLE products
  ADD COLUMN category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_product_type ON products(product_type);
