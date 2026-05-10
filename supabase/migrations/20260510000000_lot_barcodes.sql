-- ============================================================
-- Lot barcodes + denormalized org_id for fast scan lookups
--
-- Adds barcode (vendor or auto-generated) so production runs can
-- consume a lot by scanning. Adds org_id directly on material_lots
-- so the scan endpoint can validate org membership without joining
-- through raw_materials.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Add org_id to material_lots (was previously join-through RLS)
-- ----------------------------------------------------------------
ALTER TABLE material_lots
  ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE material_lots ml
SET org_id = rm.org_id
FROM raw_materials rm
WHERE ml.material_id = rm.id;

ALTER TABLE material_lots
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX idx_material_lots_org_id ON material_lots(org_id);

-- Replace the join-through policy with direct tenancy check
DROP POLICY IF EXISTS "Access via parent" ON material_lots;
CREATE POLICY "Tenant isolation" ON material_lots
  FOR ALL USING (org_id = public.user_org_id());

-- ----------------------------------------------------------------
-- 2. Barcode column + uniqueness
-- ----------------------------------------------------------------
ALTER TABLE material_lots
  ADD COLUMN barcode TEXT,
  ADD CONSTRAINT material_lots_barcode_length_chk
    CHECK (barcode IS NULL OR length(barcode) BETWEEN 1 AND 64);

-- Partial unique: multiple NULLs allowed; values unique per org.
CREATE UNIQUE INDEX idx_material_lots_org_barcode
  ON material_lots(org_id, barcode)
  WHERE barcode IS NOT NULL;
