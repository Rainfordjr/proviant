-- Add UPC/GTIN company prefix fields to organizations
-- A UPC company prefix is typically 6-10 digits; a GS1 company prefix (for GTIN) is 6-12 digits.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS upc_prefix TEXT,
  ADD COLUMN IF NOT EXISTS gtin_prefix TEXT;

COMMENT ON COLUMN organizations.upc_prefix IS 'Company prefix assigned by GS1 for UPC-A codes (6-10 digits)';
COMMENT ON COLUMN organizations.gtin_prefix IS 'GS1 company prefix for GTIN-14 codes (6-12 digits)';
