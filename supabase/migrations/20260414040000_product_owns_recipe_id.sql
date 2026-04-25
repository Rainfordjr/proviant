-- ============================================================
-- Migration: Move recipe↔product FK from recipes to products
--
-- The hierarchy is: Recipe is created first, then the product
-- references which recipe produces it. This is more natural
-- because not every product has a recipe (packaged goods don't),
-- but every recipe-produced product does.
-- ============================================================

-- 1. Add recipe_id to products (nullable — only base-unit products have one)
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_recipe_id ON products(recipe_id);

-- 2. Copy the existing relationships from recipes.product_id → products.recipe_id
UPDATE products p
SET recipe_id = r.id
FROM recipes r
WHERE r.product_id = p.id;

-- 3. Drop the product_id column from recipes
ALTER TABLE recipes DROP COLUMN IF EXISTS product_id;

-- 4. Drop the old index
DROP INDEX IF EXISTS idx_recipes_product_id;

-- 5. Update the batch_list view to join products via recipe
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
  COALESCE(p_batch.name, p_recipe.name) AS product_name,
  COALESCE(p_batch.sku, p_recipe.sku)   AS product_sku
FROM batches b
LEFT JOIN recipes r ON r.id = b.recipe_id
LEFT JOIN products p_batch  ON p_batch.id = b.product_id
LEFT JOIN products p_recipe ON p_recipe.recipe_id = b.recipe_id;
