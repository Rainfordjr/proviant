-- ============================================================
-- Proviant: Recipe Version Sections
-- Allows grouping ingredients into named sections within a
-- recipe version (e.g. "Crust", "Filling", "Topping").
-- Ingredients with NULL section_id remain in a default group
-- for backward compatibility.
-- ============================================================

-- ============================================================
-- 1. SECTIONS TABLE
-- ============================================================
CREATE TABLE recipe_version_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id UUID NOT NULL REFERENCES recipe_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rvs_version_id ON recipe_version_sections(recipe_version_id);

-- ============================================================
-- 2. LINK INGREDIENTS → SECTIONS
-- ============================================================
ALTER TABLE recipe_version_ingredients
  ADD COLUMN section_id UUID REFERENCES recipe_version_sections(id) ON DELETE SET NULL;

CREATE INDEX idx_rvi_section_id ON recipe_version_ingredients(section_id);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE recipe_version_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via parent" ON recipe_version_sections
  FOR ALL USING (
    recipe_version_id IN (
      SELECT rv.id FROM recipe_versions rv
      JOIN recipes r ON rv.recipe_id = r.id
      WHERE r.org_id = public.user_org_id()
    )
  );
