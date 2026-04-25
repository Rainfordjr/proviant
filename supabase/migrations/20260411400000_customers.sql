-- ============================================================
-- Proviant: Customers
-- ============================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_org_id ON customers(org_id);

-- Link orders to customers instead of just storing a name string
ALTER TABLE orders
  ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON customers
  FOR ALL USING (org_id = public.user_org_id());

-- Timestamps
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add customer permissions
INSERT INTO permissions (code, category, name, description) VALUES
  ('customers.view',   'Customers', 'View Customers',   'View customer list and details'),
  ('customers.create', 'Customers', 'Create Customers', 'Add new customers'),
  ('customers.edit',   'Customers', 'Edit Customers',   'Edit customer details'),
  ('customers.delete', 'Customers', 'Delete Customers', 'Delete customers');

-- NOTE: Role-permission grants for customers are in seed.sql
-- (roles are seeded, not created in migrations)
