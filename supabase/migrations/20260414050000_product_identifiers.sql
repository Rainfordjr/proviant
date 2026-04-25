-- ============================================================
-- Migration: Add UPC and GTIN identifiers to products
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS upc TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gtin TEXT;

-- UPC should be unique within an org
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_upc
  ON products(org_id, upc) WHERE upc IS NOT NULL;

-- GTIN should be unique within an org
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_gtin
  ON products(org_id, gtin) WHERE gtin IS NOT NULL;
