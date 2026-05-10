-- Production lines: physical (or logical) workstations that batches can be
-- assigned to. The "production satellite" PWA filters its queue by line so
-- one team in a bakery sees only the work for their bench/oven.

CREATE TABLE production_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_production_lines_org_name_unique
  ON production_lines(org_id, lower(name));
CREATE INDEX idx_production_lines_org_sort ON production_lines(org_id, sort_order);

ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON production_lines
  FOR ALL USING (org_id = public.user_org_id());

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON production_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Schedule batches to lines + time slots
ALTER TABLE batches
  ADD COLUMN production_line_id UUID REFERENCES production_lines(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_for TIMESTAMPTZ;

CREATE INDEX idx_batches_line_scheduled
  ON batches(production_line_id, scheduled_for);

-- Permissions (live alongside batches.* in the 'batches' module)
INSERT INTO permissions (code, category, name, description, module_slug) VALUES
  ('production_lines.view',   'Production', 'View Production Lines',   'View production lines',   'batches'),
  ('production_lines.create', 'Production', 'Create Production Lines', 'Create new production lines', 'batches'),
  ('production_lines.edit',   'Production', 'Edit Production Lines',   'Edit production lines',   'batches'),
  ('production_lines.delete', 'Production', 'Delete Production Lines', 'Delete production lines', 'batches');

-- Auto-grant production_lines.* to any role already holding batches.*
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p2.id
FROM role_permissions rp
JOIN permissions p1 ON rp.permission_id = p1.id
JOIN permissions p2 ON p2.code = REPLACE(p1.code, 'batches.', 'production_lines.')
WHERE p1.code LIKE 'batches.%'
  AND p2.code LIKE 'production_lines.%'
ON CONFLICT DO NOTHING;
