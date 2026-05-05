-- ============================================================
-- Proviant: Recipes & Product Component Hierarchy
-- ============================================================

-- ============================================================
-- 1. RECIPES (formulas that produce output)
-- ============================================================
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  yield_quantity NUMERIC NOT NULL DEFAULT 1,
  yield_unit TEXT NOT NULL DEFAULT 'each',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_org_id ON recipes(org_id);

-- ============================================================
-- 2. RECIPE INGREDIENTS (what raw materials a recipe needs)
-- ============================================================
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_material_id ON recipe_ingredients(raw_material_id);

-- ============================================================
-- 3. PRODUCT COMPONENTS (what goes INTO a product)
--    A product can contain recipe output OR another product.
--    This enables unlimited nesting depth.
-- ============================================================
CREATE TABLE product_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK (component_type IN ('recipe', 'product')),
  recipe_id UUID REFERENCES recipes(id) ON DELETE RESTRICT,
  component_product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'each',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure exactly one source is set based on type
  CONSTRAINT valid_component CHECK (
    (component_type = 'recipe' AND recipe_id IS NOT NULL AND component_product_id IS NULL)
    OR
    (component_type = 'product' AND component_product_id IS NOT NULL AND recipe_id IS NULL)
  ),

  -- Prevent a product from containing itself
  CONSTRAINT no_self_reference CHECK (product_id != component_product_id)
);

CREATE INDEX idx_product_components_product_id ON product_components(product_id);
CREATE INDEX idx_product_components_recipe_id ON product_components(recipe_id);
CREATE INDEX idx_product_components_component_product_id ON product_components(component_product_id);

-- ============================================================
-- 4. ALTER BATCHES: link to recipe instead of (only) product
--    A batch produces a recipe's output. Keep product_id for
--    backward compat but make it nullable; add recipe_id.
-- ============================================================
ALTER TABLE batches
  ADD COLUMN recipe_id UUID REFERENCES recipes(id) ON DELETE RESTRICT;

ALTER TABLE batches
  ALTER COLUMN product_id DROP NOT NULL;

CREATE INDEX idx_batches_recipe_id ON batches(recipe_id);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

-- Recipes: tenant isolation
CREATE POLICY "Tenant isolation" ON recipes
  FOR ALL USING (org_id = public.user_org_id());

-- Recipe ingredients: access through parent recipe
CREATE POLICY "Access via parent" ON recipe_ingredients
  FOR ALL USING (
    recipe_id IN (SELECT id FROM recipes WHERE org_id = public.user_org_id())
  );

-- Product components: access through parent product
CREATE POLICY "Access via parent" ON product_components
  FOR ALL USING (
    product_id IN (SELECT id FROM products WHERE org_id = public.user_org_id())
  );

-- ============================================================
-- 6. AUTO-UPDATE TIMESTAMPS for recipes
-- ============================================================
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. FIX batch_details VIEW (product_id is now nullable)
-- ============================================================
DROP VIEW IF EXISTS batch_details;
CREATE VIEW batch_details AS
SELECT
  b.*,
  p.name AS product_name,
  p.sku AS product_sku,
  r.name AS recipe_name,
  r.yield_unit AS recipe_yield_unit,
  COUNT(bi.id) AS ingredient_count
FROM batches b
LEFT JOIN products p ON b.product_id = p.id
LEFT JOIN recipes r ON b.recipe_id = r.id
LEFT JOIN batch_ingredients bi ON b.id = bi.batch_id
GROUP BY b.id, p.name, p.sku, r.name, r.yield_unit;
