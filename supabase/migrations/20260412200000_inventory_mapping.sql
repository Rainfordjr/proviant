-- ============================================================
-- Proviant: Inventory Mapping Module
-- Visual warehouse layouts with zones, aisles, racks, and bins
-- ============================================================

-- A site is a physical location (warehouse, cold storage, etc.)
CREATE TABLE warehouse_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  -- Grid dimensions for the layout designer
  grid_rows INT NOT NULL DEFAULT 10,
  grid_cols INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warehouse_sites_org_id ON warehouse_sites(org_id);

-- Zones are named areas within a site (Dry Storage, Cold Room, Shipping, etc.)
CREATE TABLE warehouse_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES warehouse_sites(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',  -- Hex color for visual display
  -- Grid position and size
  grid_row INT NOT NULL DEFAULT 0,
  grid_col INT NOT NULL DEFAULT 0,
  grid_row_span INT NOT NULL DEFAULT 1,
  grid_col_span INT NOT NULL DEFAULT 1,
  description TEXT,
  zone_type TEXT NOT NULL DEFAULT 'storage'
    CHECK (zone_type IN ('storage', 'receiving', 'shipping', 'production', 'cold', 'freezer', 'quarantine', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warehouse_zones_site_id ON warehouse_zones(site_id);

-- Racks / shelving units within a zone
CREATE TABLE warehouse_racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES warehouse_zones(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,            -- e.g. "Rack A", "Shelf 1"
  levels INT NOT NULL DEFAULT 1, -- Number of vertical levels
  positions_per_level INT NOT NULL DEFAULT 1, -- Number of bins per level
  -- Position within the zone grid
  grid_row INT NOT NULL DEFAULT 0,
  grid_col INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warehouse_racks_zone_id ON warehouse_racks(zone_id);

-- Individual bin locations (the actual storage spots)
CREATE TABLE warehouse_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id UUID NOT NULL REFERENCES warehouse_racks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,             -- e.g. "A-1-3" (Rack A, Level 1, Position 3)
  barcode TEXT,                    -- Scannable barcode/QR code value
  level INT NOT NULL DEFAULT 1,
  position INT NOT NULL DEFAULT 1,
  bin_type TEXT NOT NULL DEFAULT 'pallet'
    CHECK (bin_type IN ('pallet', 'shelf', 'floor', 'bin', 'tote', 'other')),
  max_capacity NUMERIC(10,2),     -- Optional capacity limit
  capacity_unit TEXT,              -- lbs, kg, pallets, cases, etc.
  is_occupied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warehouse_bins_rack_id ON warehouse_bins(rack_id);
CREATE INDEX idx_warehouse_bins_barcode ON warehouse_bins(barcode);

-- What's currently in a bin (pallet/lot/product assignments)
CREATE TABLE bin_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id UUID NOT NULL REFERENCES warehouse_bins(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Can hold a product, material lot, or batch
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  material_lot_id UUID REFERENCES material_lots(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2),
  unit TEXT,
  pallet_id TEXT,                 -- External pallet barcode/ID
  notes TEXT,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  placed_by UUID REFERENCES users(id),
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES users(id)
);

CREATE INDEX idx_bin_contents_bin_id ON bin_contents(bin_id);
CREATE INDEX idx_bin_contents_pallet_id ON bin_contents(pallet_id);

-- RLS
ALTER TABLE warehouse_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON warehouse_sites FOR ALL USING (org_id = public.user_org_id());

ALTER TABLE warehouse_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON warehouse_zones FOR ALL USING (org_id = public.user_org_id());

ALTER TABLE warehouse_racks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON warehouse_racks FOR ALL USING (org_id = public.user_org_id());

ALTER TABLE warehouse_bins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON warehouse_bins FOR ALL USING (org_id = public.user_org_id());

ALTER TABLE bin_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON bin_contents FOR ALL USING (org_id = public.user_org_id());

-- Timestamps
CREATE TRIGGER set_updated_at BEFORE UPDATE ON warehouse_sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON warehouse_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON warehouse_racks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON warehouse_bins FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add inventory mapping permissions
INSERT INTO permissions (code, category, name, description) VALUES
  ('warehouse.view',   'Warehouse', 'View Warehouse',   'View warehouse sites, zones, and bin maps'),
  ('warehouse.create', 'Warehouse', 'Create Warehouse',  'Create warehouse sites and zones'),
  ('warehouse.edit',   'Warehouse', 'Edit Warehouse',    'Edit layouts, racks, and bins'),
  ('warehouse.manage', 'Warehouse', 'Manage Inventory',  'Place and remove items in bins');
