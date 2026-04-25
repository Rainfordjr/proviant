-- ============================================================
-- Proviant: Recipe Versioning, Approval Workflow & R&D
-- ============================================================

-- ============================================================
-- 1. RECIPE VERSIONS
--    Each recipe can have many versions. Only one draft at a time.
--    Approved versions are immutable.
--    Workflow: draft → submitted → approved (or rejected → new draft)
-- ============================================================
CREATE TABLE recipe_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),

  -- Version-specific recipe data (moved from recipes table)
  yield_quantity NUMERIC NOT NULL DEFAULT 1,
  yield_unit TEXT NOT NULL DEFAULT 'each',
  instructions TEXT,
  change_notes TEXT,

  -- Audit trail
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  submitted_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ,

  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejection_notes TEXT,

  UNIQUE(recipe_id, version_number)
);

CREATE INDEX idx_recipe_versions_recipe_id ON recipe_versions(recipe_id);
CREATE INDEX idx_recipe_versions_status ON recipe_versions(status);

-- ============================================================
-- 2. RECIPE VERSION INGREDIENTS
--    Ingredients are tied to a specific version, not the recipe.
-- ============================================================
CREATE TABLE recipe_version_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_version_id UUID NOT NULL REFERENCES recipe_versions(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rvi_version_id ON recipe_version_ingredients(recipe_version_id);
CREATE INDEX idx_rvi_material_id ON recipe_version_ingredients(raw_material_id);

-- ============================================================
-- 3. UPDATE RECIPES TABLE
--    Add pointer to current approved version.
--    Keep yield_quantity/yield_unit/instructions for backward compat
--    but they'll be read from the current approved version going forward.
-- ============================================================
ALTER TABLE recipes
  ADD COLUMN current_version_id UUID REFERENCES recipe_versions(id);

-- ============================================================
-- 4. UPDATE BATCHES
--    Link to specific recipe version (not just recipe).
--    Add batch_type for production vs development.
-- ============================================================
ALTER TABLE batches
  ADD COLUMN recipe_version_id UUID REFERENCES recipe_versions(id),
  ADD COLUMN batch_type TEXT NOT NULL DEFAULT 'production'
    CHECK (batch_type IN ('production', 'development'));

CREATE INDEX idx_batches_recipe_version_id ON batches(recipe_version_id);
CREATE INDEX idx_batches_batch_type ON batches(batch_type);

-- ============================================================
-- 5. PRODUCT COMPONENTS: update to reference recipe_version
--    Add optional recipe_version_id alongside recipe_id
-- ============================================================
ALTER TABLE product_components
  ADD COLUMN recipe_version_id UUID REFERENCES recipe_versions(id);

-- ============================================================
-- 6. DEV PROJECTS (R&D tracking)
-- ============================================================
CREATE TABLE dev_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  target_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dev_projects_org_id ON dev_projects(org_id);
CREATE INDEX idx_dev_projects_status ON dev_projects(status);

-- ============================================================
-- 7. DEV BATCH NOTES (log results on dev batches)
-- ============================================================
CREATE TABLE dev_batch_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'observation'
    CHECK (note_type IN ('observation', 'test_result', 'adjustment', 'conclusion')),
  content TEXT NOT NULL,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dev_batch_notes_batch_id ON dev_batch_notes(batch_id);

-- ============================================================
-- 8. LINK BATCHES TO DEV PROJECTS
-- ============================================================
ALTER TABLE batches
  ADD COLUMN dev_project_id UUID REFERENCES dev_projects(id) ON DELETE SET NULL;

CREATE INDEX idx_batches_dev_project_id ON batches(dev_project_id);

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_version_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_batch_notes ENABLE ROW LEVEL SECURITY;

-- Recipe versions: access through parent recipe
CREATE POLICY "Access via parent" ON recipe_versions
  FOR ALL USING (
    recipe_id IN (SELECT id FROM recipes WHERE org_id = public.user_org_id())
  );

-- Recipe version ingredients: access through parent version → recipe
CREATE POLICY "Access via parent" ON recipe_version_ingredients
  FOR ALL USING (
    recipe_version_id IN (
      SELECT rv.id FROM recipe_versions rv
      JOIN recipes r ON rv.recipe_id = r.id
      WHERE r.org_id = public.user_org_id()
    )
  );

-- Dev projects: tenant isolation
CREATE POLICY "Tenant isolation" ON dev_projects
  FOR ALL USING (org_id = public.user_org_id());

-- Dev batch notes: access through parent batch
CREATE POLICY "Access via parent" ON dev_batch_notes
  FOR ALL USING (
    batch_id IN (SELECT id FROM batches WHERE org_id = public.user_org_id())
  );

-- ============================================================
-- 10. AUTO-UPDATE TIMESTAMPS
-- ============================================================
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON recipe_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON dev_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 11. UPDATE batch_details VIEW
-- ============================================================
DROP VIEW IF EXISTS batch_details;
CREATE VIEW batch_details AS
SELECT
  b.*,
  p.name AS product_name,
  p.sku AS product_sku,
  r.name AS recipe_name,
  rv.version_number AS recipe_version_number,
  rv.yield_unit AS recipe_yield_unit,
  COUNT(bi.id) AS ingredient_count
FROM batches b
LEFT JOIN products p ON b.product_id = p.id
LEFT JOIN recipes r ON b.recipe_id = r.id
LEFT JOIN recipe_versions rv ON b.recipe_version_id = rv.id
LEFT JOIN batch_ingredients bi ON b.id = bi.batch_id
GROUP BY b.id, p.name, p.sku, r.name, rv.version_number, rv.yield_unit;
