-- Add account_number and payment_terms to suppliers table
ALTER TABLE suppliers
  ADD COLUMN account_number TEXT,
  ADD COLUMN payment_terms TEXT;

COMMENT ON COLUMN suppliers.account_number IS 'Vendor account / customer number with this supplier';
COMMENT ON COLUMN suppliers.payment_terms IS 'e.g. Net 30, COD, Prepaid';
