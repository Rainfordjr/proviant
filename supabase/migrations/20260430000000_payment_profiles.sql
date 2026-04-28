-- ============================================================
-- Saved payment profiles (cards-on-file).
--
-- Architecture:
--   - Authorize.Net's Customer Information Manager (CIM) holds the
--     actual card data. Each Proviant customer maps to an Authorize.Net
--     customer profile via customers.auth_net_customer_profile_id.
--   - For each card the customer has on file, Authorize.Net issues a
--     paymentProfileId; we store that plus a masked "Visa •••• 1234"
--     summary so the UI can render the card without ever seeing the PAN.
--   - To charge a saved card, the API sends { customerProfileId,
--     paymentProfileId, amount } to Authorize.Net. No card data crosses
--     our servers.
--
-- We never store full PANs, expiry, or CVV. Just the masked metadata.
-- ============================================================


-- 1. Link customers → Authorize.Net customer profile -----------

ALTER TABLE customers
  ADD COLUMN auth_net_customer_profile_id TEXT;

CREATE UNIQUE INDEX idx_customers_auth_net_profile
  ON customers(auth_net_customer_profile_id)
  WHERE auth_net_customer_profile_id IS NOT NULL;


-- 2. customer_payment_profiles ----------------------------------

CREATE TABLE customer_payment_profiles (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id                 UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  gateway                     TEXT NOT NULL DEFAULT 'authorize_net'
                                   CHECK (gateway IN ('authorize_net')),
  gateway_customer_id         TEXT NOT NULL,    -- Authorize.Net customerProfileId
  gateway_payment_profile_id  TEXT NOT NULL,    -- Authorize.Net customerPaymentProfileId

  -- Masked card display (NO full PAN, NO CVV)
  card_type        TEXT,                        -- "Visa", "MasterCard", "AmericanExpress", etc.
  card_last4       TEXT,
  card_exp_month   TEXT,                        -- "MM" — informational only
  card_exp_year    TEXT,                        -- "YYYY" — informational only
  cardholder_name  TEXT,

  is_default       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES users(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same payment profile shouldn't be saved twice for the same customer.
  UNIQUE (customer_id, gateway, gateway_payment_profile_id)
);

CREATE INDEX idx_customer_payment_profiles_org      ON customer_payment_profiles(org_id);
CREATE INDEX idx_customer_payment_profiles_customer ON customer_payment_profiles(customer_id);

ALTER TABLE customer_payment_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON customer_payment_profiles
  FOR ALL USING (org_id = public.user_org_id());

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON customer_payment_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
