-- ============================================================
-- Migration: Every recipe must yield a product
-- Products module is always-on (core). The optional add-on
-- becomes the packaging/packout workflow for multi-level
-- product hierarchies.
-- ============================================================

-- 1. Make products a core module again
UPDATE modules SET is_core = true WHERE slug = 'products';

-- 2. Make product_id NOT NULL on recipes (with a default strategy)
--    First, ensure any existing recipes without a product get one created.
--    This DO block creates a stub product for any orphan recipe.
DO $$
DECLARE
  r RECORD;
  new_product_id UUID;
BEGIN
  FOR r IN
    SELECT rec.id, rec.name, rec.org_id, rec.yield_quantity, rec.yield_unit
    FROM recipes rec
    WHERE rec.product_id IS NULL
  LOOP
    INSERT INTO products (id, org_id, name, sku, unit, is_active)
    VALUES (
      gen_random_uuid(),
      r.org_id,
      r.name || ' (unit)',
      'AUTO-' || LEFT(r.id::text, 8),
      COALESCE(r.yield_unit, 'each'),
      true
    )
    RETURNING id INTO new_product_id;

    UPDATE recipes SET product_id = new_product_id WHERE id = r.id;
  END LOOP;
END $$;

-- 3. Now enforce NOT NULL
ALTER TABLE recipes ALTER COLUMN product_id SET NOT NULL;
