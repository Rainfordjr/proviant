-- ============================================================
-- Migration: Make batches recipe-centric, products optional module
-- ============================================================

-- 1. Add optional product_id to recipes (direct link for "this recipe yields this product")
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recipes_product_id ON recipes(product_id);

-- 2. Make products a non-core module so orgs can toggle it on/off
UPDATE modules SET is_core = false WHERE slug = 'products';

-- 3. Ensure recipe_id on batches is prominent
--    (Already nullable from earlier migration, but let's add an index)
CREATE INDEX IF NOT EXISTS idx_batches_recipe_id ON batches(recipe_id);

-- 4. Add a helper view for batch listing that includes recipe info
CREATE OR REPLACE VIEW batch_list AS
SELECT
  b.id,
  b.org_id,
  b.batch_number,
  b.status,
  b.quantity_produced,
  b.produced_at,
  b.created_at,
  b.notes,
  b.recipe_id,
  b.product_id,
  b.recipe_version_id,
  b.batch_type,
  r.name AS recipe_name,
  p.name AS product_name,
  p.sku  AS product_sku
FROM batches b
LEFT JOIN recipes r ON r.id = b.recipe_id
LEFT JOIN products p ON p.id = b.product_id;
