-- Tables the /production-schedule UI assumed existed but were never created.
-- Same gap pattern as the assigned_to / scheduled_date columns: the UI was
-- built ahead of its schema.
--
--   equipment                          — workstation resources (ovens, mixers)
--   batch_product_allocations          — one batch may yield multiple products
--   schedule_resource_assignments      — batch ↔ equipment/user link rows

CREATE TABLE IF NOT EXISTS equipment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_org_id ON equipment(org_id);
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation" ON equipment;
CREATE POLICY "Tenant isolation" ON equipment
  FOR ALL USING (org_id = public.user_org_id());

CREATE TABLE IF NOT EXISTS batch_product_allocations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity   NUMERIC NOT NULL,
  unit       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpa_batch_id ON batch_product_allocations(batch_id);
CREATE INDEX IF NOT EXISTS idx_bpa_product_id ON batch_product_allocations(product_id);
ALTER TABLE batch_product_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access via batch" ON batch_product_allocations;
CREATE POLICY "Access via batch" ON batch_product_allocations
  FOR ALL USING (
    batch_id IN (SELECT id FROM batches WHERE org_id = public.user_org_id())
  );

CREATE TABLE IF NOT EXISTS schedule_resource_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('equipment', 'user')),
  resource_id   UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sra_batch_id ON schedule_resource_assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_sra_resource ON schedule_resource_assignments(resource_type, resource_id);
ALTER TABLE schedule_resource_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access via batch" ON schedule_resource_assignments;
CREATE POLICY "Access via batch" ON schedule_resource_assignments
  FOR ALL USING (
    batch_id IN (SELECT id FROM batches WHERE org_id = public.user_org_id())
  );
