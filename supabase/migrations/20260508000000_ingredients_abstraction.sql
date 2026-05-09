-- ============================================================
-- Ingredients abstraction layer
--
-- Splits raw_materials into two concerns:
--   - ingredients: what a recipe calls for (e.g., "Butter")
--   - raw_materials: a specific vendor SKU that fulfills an ingredient
--     (e.g., "Cascade Dairy Salted Butter, 1lb").
--
-- Multiple raw_materials can satisfy one ingredient, enabling
-- substitution between vendors. Each recipe can optionally restrict
-- which raw_materials are acceptable for its ingredients
-- (recipe_ingredient_substitutions). Allergens move from
-- raw_materials to ingredients (single source of truth, food safety).
-- ============================================================

-- ----------------------------------------------------------------
-- 1. NEW INGREDIENTS TABLE
-- ----------------------------------------------------------------
CREATE TABLE ingredients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'lbs',
  description TEXT,
  allergens   TEXT[] NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ingredients_org_name_unique
  ON ingredients(org_id, lower(name));
CREATE INDEX idx_ingredients_org_id ON ingredients(org_id);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON ingredients
  FOR ALL USING (org_id = public.user_org_id());

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------
-- 2. ADD INGREDIENT_ID TO RAW_MATERIALS + BACKFILL
-- ----------------------------------------------------------------
ALTER TABLE raw_materials
  ADD COLUMN ingredient_id UUID REFERENCES ingredients(id) ON DELETE RESTRICT;

-- Create one ingredient per existing raw_material (1:1 starting point;
-- operators can manually merge later). Allergens copy across now and
-- the column gets dropped from raw_materials at the end of this
-- migration.
INSERT INTO ingredients (id, org_id, name, unit, description, allergens, is_active)
SELECT
  gen_random_uuid(),
  org_id,
  name,
  COALESCE(unit, 'lbs'),
  description,
  COALESCE(allergens, '{}'),
  is_active
FROM raw_materials;

UPDATE raw_materials rm
SET ingredient_id = i.id
FROM ingredients i
WHERE i.org_id = rm.org_id
  AND lower(i.name) = lower(rm.name);

ALTER TABLE raw_materials
  ALTER COLUMN ingredient_id SET NOT NULL;

CREATE INDEX idx_raw_materials_ingredient_id ON raw_materials(ingredient_id);

-- Drop the per-material allergen fields. The ingredient is now the
-- single source of truth.
ALTER TABLE raw_materials
  DROP COLUMN IF EXISTS allergens,
  DROP COLUMN IF EXISTS allergen_notes;

-- ----------------------------------------------------------------
-- 3. SWITCH RECIPE_INGREDIENTS TO INGREDIENT_ID
-- ----------------------------------------------------------------
ALTER TABLE recipe_ingredients
  ADD COLUMN ingredient_id UUID REFERENCES ingredients(id) ON DELETE RESTRICT;

UPDATE recipe_ingredients ri
SET ingredient_id = rm.ingredient_id
FROM raw_materials rm
WHERE ri.raw_material_id = rm.id;

ALTER TABLE recipe_ingredients
  ALTER COLUMN ingredient_id SET NOT NULL;

DROP INDEX IF EXISTS idx_recipe_ingredients_material_id;
ALTER TABLE recipe_ingredients DROP COLUMN raw_material_id;
CREATE INDEX idx_recipe_ingredients_ingredient_id
  ON recipe_ingredients(ingredient_id);

-- ----------------------------------------------------------------
-- 4. SWITCH RECIPE_VERSION_INGREDIENTS TO INGREDIENT_ID
-- ----------------------------------------------------------------
ALTER TABLE recipe_version_ingredients
  ADD COLUMN ingredient_id UUID REFERENCES ingredients(id) ON DELETE RESTRICT;

UPDATE recipe_version_ingredients rvi
SET ingredient_id = rm.ingredient_id
FROM raw_materials rm
WHERE rvi.raw_material_id = rm.id;

ALTER TABLE recipe_version_ingredients
  ALTER COLUMN ingredient_id SET NOT NULL;

DROP INDEX IF EXISTS idx_rvi_material_id;
ALTER TABLE recipe_version_ingredients DROP COLUMN raw_material_id;
CREATE INDEX idx_rvi_ingredient_id
  ON recipe_version_ingredients(ingredient_id);

-- ----------------------------------------------------------------
-- 5. RECIPE INGREDIENT SUBSTITUTIONS (per-recipe allow-list)
--
-- Lives on the recipe (not on the version). Editing an allow-list
-- doesn't bump a version — only changes to the ingredient set or
-- quantities should do that.
--
-- Empty list for (recipe_id, ingredient_id) = any active material
-- under that ingredient is acceptable. Non-empty = restricted to the
-- listed materials only.
-- ----------------------------------------------------------------
CREATE TABLE recipe_ingredient_substitutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, ingredient_id, raw_material_id)
);

CREATE INDEX idx_ris_recipe_ingredient
  ON recipe_ingredient_substitutions(recipe_id, ingredient_id);
CREATE INDEX idx_ris_raw_material_id
  ON recipe_ingredient_substitutions(raw_material_id);

ALTER TABLE recipe_ingredient_substitutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent" ON recipe_ingredient_substitutions
  FOR ALL USING (
    recipe_id IN (SELECT id FROM recipes WHERE org_id = public.user_org_id())
  );

-- Trigger: enforce that the chosen raw_material's ingredient matches
-- the row's ingredient_id. Otherwise the allow-list could point at a
-- material that doesn't satisfy the ingredient at all.
CREATE OR REPLACE FUNCTION enforce_substitution_ingredient_match()
RETURNS TRIGGER AS $$
DECLARE
  mat_ing UUID;
BEGIN
  SELECT ingredient_id INTO mat_ing
    FROM raw_materials WHERE id = NEW.raw_material_id;
  IF mat_ing IS DISTINCT FROM NEW.ingredient_id THEN
    RAISE EXCEPTION
      'raw_material % is for ingredient %, not % (substitution mismatch)',
      NEW.raw_material_id, mat_ing, NEW.ingredient_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER chk_substitution_ingredient_match
  BEFORE INSERT OR UPDATE ON recipe_ingredient_substitutions
  FOR EACH ROW EXECUTE FUNCTION enforce_substitution_ingredient_match();

-- ----------------------------------------------------------------
-- 6. PERMISSIONS
-- ----------------------------------------------------------------
INSERT INTO permissions (code, category, name, description, module_slug) VALUES
  ('ingredients.view',   'Ingredients', 'View Ingredients',   'View the master ingredient list', 'materials'),
  ('ingredients.create', 'Ingredients', 'Create Ingredients', 'Create new ingredients',          'materials'),
  ('ingredients.edit',   'Ingredients', 'Edit Ingredients',   'Edit ingredient details',         'materials'),
  ('ingredients.delete', 'Ingredients', 'Delete Ingredients', 'Delete ingredients',              'materials');

-- Grant ingredients.* to any role that already has the matching
-- materials.* perm. New roles default closed; admin roles already
-- bypass via is_admin.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p2.id
FROM role_permissions rp
JOIN permissions p1 ON rp.permission_id = p1.id
JOIN permissions p2 ON p2.code = REPLACE(p1.code, 'materials.', 'ingredients.')
WHERE p1.code LIKE 'materials.%'
  AND p2.code LIKE 'ingredients.%'
ON CONFLICT DO NOTHING;
