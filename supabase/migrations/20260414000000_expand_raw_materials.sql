-- Expand raw_materials with vendor product details, identifiers, shelf life,
-- packaging, allergens, and spec sheet info.

-- ── Naming & identification ──────────────────────────────────
ALTER TABLE raw_materials
  ADD COLUMN vendor_name       TEXT,                          -- what the vendor calls this product
  ADD COLUMN item_code         TEXT,                          -- internal code e.g. RM10001
  ADD COLUMN sku               TEXT,
  ADD COLUMN upc               TEXT,
  ADD COLUMN gtin              TEXT,
  ADD COLUMN vendor_item_number TEXT;                         -- vendor catalog / ordering number

COMMENT ON COLUMN raw_materials.name             IS 'Internal / in-house name for this material';
COMMENT ON COLUMN raw_materials.vendor_name      IS 'Vendor product name (as listed on their catalog)';
COMMENT ON COLUMN raw_materials.item_code        IS 'Master ingredient list code (e.g. RM10001)';
COMMENT ON COLUMN raw_materials.vendor_item_number IS 'Vendor catalog/item number used for ordering';

-- ── Classification ───────────────────────────────────────────
ALTER TABLE raw_materials
  ADD COLUMN category          TEXT DEFAULT 'Raw Material',   -- Raw Material | WIP
  ADD COLUMN item_type         TEXT,                          -- e.g. Flour, Sugar, Butter
  ADD COLUMN brand             TEXT;                          -- brand or variant

COMMENT ON COLUMN raw_materials.category  IS 'Raw Material or WIP';
COMMENT ON COLUMN raw_materials.item_type IS 'Granular type e.g. Flour, Sugar, Butter';

-- ── Shelf life ───────────────────────────────────────────────
ALTER TABLE raw_materials
  ADD COLUMN shelf_life_qty         SMALLINT,
  ADD COLUMN shelf_life_unit        TEXT,                     -- Days | Weeks | Months | Years
  ADD COLUMN opened_shelf_life_qty  SMALLINT,
  ADD COLUMN opened_shelf_life_unit TEXT;

COMMENT ON COLUMN raw_materials.shelf_life_qty         IS 'Numeric shelf life duration (unopened)';
COMMENT ON COLUMN raw_materials.shelf_life_unit        IS 'Days | Weeks | Months | Years';
COMMENT ON COLUMN raw_materials.opened_shelf_life_qty  IS 'Numeric shelf life after opening';
COMMENT ON COLUMN raw_materials.opened_shelf_life_unit IS 'Days | Weeks | Months | Years';

-- ── Allergens (Big 9 + other) ────────────────────────────────
ALTER TABLE raw_materials
  ADD COLUMN allergens         TEXT[] DEFAULT '{}',           -- array of allergen keys
  ADD COLUMN allergen_notes    TEXT;                          -- free-text for non-Big-9

COMMENT ON COLUMN raw_materials.allergens      IS 'Array of FDA Big 9 allergen keys present';
COMMENT ON COLUMN raw_materials.allergen_notes IS 'Additional allergen notes beyond the Big 9';

-- ── Storage & cost ───────────────────────────────────────────
ALTER TABLE raw_materials
  ADD COLUMN storage_requirements TEXT,                       -- Ambient | Refrigerated | Frozen
  ADD COLUMN cost               NUMERIC(10,2),               -- vendor cost per unit
  ADD COLUMN unit_conversion_factor NUMERIC(10,4);            -- ordering-unit → usage-unit factor

COMMENT ON COLUMN raw_materials.storage_requirements    IS 'Ambient, Refrigerated, or Frozen';
COMMENT ON COLUMN raw_materials.cost                    IS 'Vendor cost per unit';
COMMENT ON COLUMN raw_materials.unit_conversion_factor  IS 'Conversion factor: ordering units → usage units';

-- ── Packaging ────────────────────────────────────────────────
ALTER TABLE raw_materials
  ADD COLUMN packaging_size    TEXT,                          -- e.g. 50 lb, 1 gal
  ADD COLUMN inner_pack_size   TEXT,
  ADD COLUMN inner_pack_type   TEXT,                          -- bag | box | pouch
  ADD COLUMN outer_pack_type   TEXT;                          -- case | pallet

-- ── Spec sheet & composition ─────────────────────────────────
ALTER TABLE raw_materials
  ADD COLUMN spec_sheet_number TEXT,
  ADD COLUMN ingredients_list  TEXT,                          -- ingredient list from spec sheet
  ADD COLUMN nutritional_info  TEXT,                          -- nutrition facts text
  ADD COLUMN notes             TEXT;                          -- general notes

COMMENT ON COLUMN raw_materials.spec_sheet_number IS 'Number on vendor spec sheet';
COMMENT ON COLUMN raw_materials.ingredients_list  IS 'Ingredient list pasted from spec sheet';
COMMENT ON COLUMN raw_materials.nutritional_info  IS 'Nutritional data pasted from spec sheet';

-- ── Indexes for common lookups ───────────────────────────────
CREATE INDEX idx_raw_materials_item_code ON raw_materials(item_code);
CREATE INDEX idx_raw_materials_sku ON raw_materials(sku);
CREATE INDEX idx_raw_materials_category ON raw_materials(category);
