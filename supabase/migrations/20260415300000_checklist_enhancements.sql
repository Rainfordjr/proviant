-- ══════════════════════════════════════════════════════════════════
-- Checklist Enhancements Migration
-- Brings the checklist system in line with the stations/main app:
--   • Version workflow (draft → review → approved → archived)
--   • Expanded answer types (13 types)
--   • Checklist runs (standalone execution + answers)
--   • Categories with colors
--   • Sign-off / approval on task completions and runs
--   • Extended condition operators
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Checklist Categories ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#3B82F6',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_categories_org ON checklist_categories(org_id);
ALTER TABLE checklist_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklist_categories_tenant ON checklist_categories
  USING (org_id = public.user_org_id());

-- ── 2. Task Categories ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#3B82F6',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_categories_org ON task_categories(org_id);
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_categories_tenant ON task_categories
  USING (org_id = public.user_org_id());

-- ── 3. Add category to checklist_templates ──────────────────────
ALTER TABLE checklist_templates
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES checklist_categories(id) ON DELETE SET NULL;

-- ── 4. Add category to tasks ────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL;

-- ── 5. Version workflow upgrade ─────────────────────────────────
-- Replace is_published with a full status workflow + audit trail
ALTER TABLE checklist_template_versions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_for_review_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN checklist_template_versions.status IS 'draft | review | approved | archived';

-- Migrate existing data: is_published = true → status = approved
UPDATE checklist_template_versions SET status = 'approved' WHERE is_published = true AND status = 'draft';
UPDATE checklist_template_versions SET status = 'draft' WHERE is_published = false AND status = 'draft';

-- ── 6. Expand answer types + config on template items ───────────
-- Update the comment to reflect all supported types
COMMENT ON COLUMN checklist_template_items.answer_type IS
  'checkbox | yes_no | true_false | text | select | number | photo | datetime | temperature | radio | multi_select | employee_list | barcode_scan | text_match | signature';

ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS config JSONB;

COMMENT ON COLUMN checklist_template_items.config IS
  'Type-specific configuration, e.g. {"unit":"F"} for temperature, {"min":0,"max":100} for number, {"departments":["dept-id"]} for employee_list';

-- Expand condition operators comment
COMMENT ON COLUMN checklist_template_items.condition_operator IS
  'equals | not_equals | contains | not_empty | gt | lt | gte | lte';

-- ── 7. Expand answer types + config on task checklist items ─────
COMMENT ON COLUMN task_checklist_items.answer_type IS
  'checkbox | yes_no | true_false | text | select | number | photo | datetime | temperature | radio | multi_select | employee_list | barcode_scan | text_match | signature';

ALTER TABLE task_checklist_items
  ADD COLUMN IF NOT EXISTS config JSONB,
  ADD COLUMN IF NOT EXISTS answer_meta JSONB;

COMMENT ON COLUMN task_checklist_items.config IS
  'Type-specific configuration copied from template';
COMMENT ON COLUMN task_checklist_items.answer_meta IS
  'Structured answer metadata, e.g. multi_select selections, employee IDs, signature data';

-- ── 8. Checklist Runs ───────────────────────────────────────────
-- Standalone execution of a checklist (separate from tasks)
CREATE TABLE IF NOT EXISTS checklist_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  checklist_id     UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  version_id       UUID NOT NULL REFERENCES checklist_template_versions(id) ON DELETE CASCADE,
  started_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'in_progress',
  notes            TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  approved_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN checklist_runs.status IS 'in_progress | completed | approved';

CREATE INDEX idx_checklist_runs_org ON checklist_runs(org_id);
CREATE INDEX idx_checklist_runs_checklist ON checklist_runs(checklist_id);
CREATE INDEX idx_checklist_runs_status ON checklist_runs(status);

ALTER TABLE checklist_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklist_runs_tenant ON checklist_runs
  USING (org_id = public.user_org_id());

-- ── 9. Checklist Run Answers ────────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_run_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES checklist_runs(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES checklist_template_items(id) ON DELETE CASCADE,
  answer_type  TEXT NOT NULL DEFAULT 'checkbox',
  answer_value TEXT,
  answer_meta  JSONB,
  item_config  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_run_answers_run ON checklist_run_answers(run_id);

ALTER TABLE checklist_run_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklist_run_answers_tenant ON checklist_run_answers
  USING (
    run_id IN (
      SELECT id FROM checklist_runs WHERE org_id = public.user_org_id()
    )
  );

-- ── 10. Task Completions table ──────────────────────────────────
-- Tracks each completion of a task (especially for recurring tasks)
CREATE TABLE IF NOT EXISTS task_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           TEXT,
  period_start    DATE,
  period_end      DATE,
  status          TEXT NOT NULL DEFAULT 'pending',
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  checklist_run_id UUID REFERENCES checklist_runs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN task_completions.status IS 'pending | approved | rejected';

CREATE INDEX idx_task_completions_task ON task_completions(task_id);
CREATE INDEX idx_task_completions_status ON task_completions(status);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_completions_tenant ON task_completions
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE org_id = public.user_org_id()
    )
  );

-- ── 11. Permissions for new features ────────────────────────────
INSERT INTO permissions (code, category, name, description, module_slug) VALUES
  ('checklists.run',     'Checklists', 'Run Checklists',     'Execute checklist runs',           'tasks'),
  ('checklists.approve', 'Checklists', 'Approve Checklists', 'Approve completed checklist runs', 'tasks'),
  ('tasks.approve',      'Tasks',      'Approve Tasks',      'Approve task completions',         'tasks')
ON CONFLICT (code) DO NOTHING;

-- Auto-grant to existing task roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM permissions p
CROSS JOIN (
  SELECT DISTINCT role_id FROM role_permissions
  WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'tasks.view')
) rp
WHERE p.code IN ('checklists.run', 'checklists.approve', 'tasks.approve')
ON CONFLICT DO NOTHING;
