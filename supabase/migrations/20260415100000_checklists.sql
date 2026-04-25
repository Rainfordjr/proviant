-- ── Checklist Templates ──────────────────────────────────────────
-- Reusable checklist definitions with versioning.
-- Items are copied onto tasks at assignment time so each task
-- instance tracks completion independently.

-- Template header
CREATE TABLE IF NOT EXISTS checklist_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_templates_org ON checklist_templates(org_id);

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_templates_tenant ON checklist_templates
  USING (org_id = public.user_org_id());

-- Template versions
CREATE TABLE IF NOT EXISTS checklist_template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  version_number  INT NOT NULL DEFAULT 1,
  notes           TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, version_number)
);

CREATE INDEX idx_checklist_versions_template ON checklist_template_versions(template_id);

ALTER TABLE checklist_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_template_versions_tenant ON checklist_template_versions
  USING (
    template_id IN (
      SELECT id FROM checklist_templates WHERE org_id = public.user_org_id()
    )
  );

-- Template items (belong to a version)
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id  UUID NOT NULL REFERENCES checklist_template_versions(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_checklist_items_version ON checklist_template_items(version_id);

ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_template_items_tenant ON checklist_template_items
  USING (
    version_id IN (
      SELECT v.id FROM checklist_template_versions v
      JOIN checklist_templates t ON t.id = v.template_id
      WHERE t.org_id = public.user_org_id()
    )
  );

-- ── Task Checklist Items ────────────────────────────────────────
-- Copied from a template version when a task is created.
-- Each row is independently checkable.

CREATE TABLE IF NOT EXISTS task_checklist_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  description         TEXT,
  sort_order          INT NOT NULL DEFAULT 0,
  is_required         BOOLEAN NOT NULL DEFAULT false,
  is_checked          BOOLEAN NOT NULL DEFAULT false,
  checked_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at          TIMESTAMPTZ,
  source_template_id  UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  source_version_id   UUID REFERENCES checklist_template_versions(id) ON DELETE SET NULL
);

CREATE INDEX idx_task_checklist_task ON task_checklist_items(task_id);

ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_checklist_items_tenant ON task_checklist_items
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE org_id = public.user_org_id()
    )
  );

-- ── Link tasks to the template they came from ──────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checklist_version_id  UUID REFERENCES checklist_template_versions(id) ON DELETE SET NULL;

-- ── Permissions ─────────────────────────────────────────────────
INSERT INTO permissions (code, category, name, description, module_slug) VALUES
  ('checklists.view',   'Checklists', 'View Checklists',   'View checklist templates',   'tasks'),
  ('checklists.create', 'Checklists', 'Create Checklists', 'Create checklist templates', 'tasks'),
  ('checklists.edit',   'Checklists', 'Edit Checklists',   'Edit checklist templates',   'tasks'),
  ('checklists.delete', 'Checklists', 'Delete Checklists', 'Delete checklist templates', 'tasks')
ON CONFLICT (code) DO NOTHING;

-- Grant checklist permissions to existing roles that have tasks permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM permissions p
CROSS JOIN (
  SELECT DISTINCT role_id FROM role_permissions
  WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'tasks.view')
) rp
WHERE p.code IN ('checklists.view', 'checklists.create', 'checklists.edit', 'checklists.delete')
ON CONFLICT DO NOTHING;
