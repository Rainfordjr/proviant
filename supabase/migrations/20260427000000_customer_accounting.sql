-- ============================================================
-- Customer-side accounting (Accounts Receivable).
--
-- Each tenant org tracks invoices, credit notes, and payments
-- against their own customers. Separate from the Proviant ↔ org
-- billing system already in place.
--
-- Design choices:
--   * Invoices + payments + applications (formal A/R), not a single
--     ledger table. Lets us track partial payments and per-invoice
--     status (open / partial / paid / void) cleanly.
--   * Credit notes are stored as customer_invoices with kind='credit_note'
--     and a negative `total`, so the balance function can sum a single
--     column.
--   * Confirmed orders auto-generate an invoice via trigger. Walk-in
--     orders (customer_id IS NULL) are skipped.
--   * All multi-step writes go through SECURITY DEFINER functions so
--     they're atomic and so the auto-invoice trigger can write to the
--     counter table without table-level grants.
-- ============================================================


-- 1. Per-org invoice number counter ---------------------------
-- We don't use a Postgres SEQUENCE because we want per-org numbering
-- (INV-2026-0001 separately for each tenant).

CREATE TABLE customer_invoice_counters (
  org_id     UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  next_value INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE customer_invoice_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER functions below should touch this.
REVOKE ALL ON TABLE customer_invoice_counters FROM PUBLIC, anon, authenticated;
GRANT  ALL ON TABLE customer_invoice_counters TO   service_role;


-- 2. customer_invoices ----------------------------------------

CREATE TABLE customer_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  invoice_number  TEXT NOT NULL,                -- e.g. "INV-2026-0001" (per-org)
  kind            TEXT NOT NULL DEFAULT 'invoice'
                       CHECK (kind IN ('invoice', 'credit_note')),
  status          TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'partial', 'paid', 'void')),

  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at          TIMESTAMPTZ,

  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- always positive (display)
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,   -- positive for invoice, negative for credit_note

  notes           TEXT,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (org_id, invoice_number),
  -- One auto-invoice per order. Multiple manual invoices (order_id IS NULL)
  -- are still allowed since NULL != NULL in unique constraints.
  UNIQUE (org_id, order_id)
);

CREATE INDEX idx_customer_invoices_org      ON customer_invoices(org_id);
CREATE INDEX idx_customer_invoices_customer ON customer_invoices(customer_id);
CREATE INDEX idx_customer_invoices_status   ON customer_invoices(status);
CREATE INDEX idx_customer_invoices_issued   ON customer_invoices(issued_at);

ALTER TABLE customer_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON customer_invoices
  FOR ALL USING (org_id = public.user_org_id());

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON customer_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 3. customer_invoice_line_items ------------------------------

CREATE TABLE customer_invoice_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount        NUMERIC(12,2) NOT NULL,           -- = quantity * unit_price (denormalized)
  product_id    UUID REFERENCES products(id)    ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_invoice_line_items_invoice
  ON customer_invoice_line_items(invoice_id);

ALTER TABLE customer_invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON customer_invoice_line_items
  FOR ALL USING (
    invoice_id IN (SELECT id FROM customer_invoices WHERE org_id = public.user_org_id())
  );


-- 4. customer_payments ----------------------------------------

CREATE TABLE customer_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method           TEXT NOT NULL DEFAULT 'other'
                        CHECK (method IN ('cash', 'check', 'card', 'ach', 'other')),
  reference_number TEXT,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT,
  recorded_by      UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_payments_org      ON customer_payments(org_id);
CREATE INDEX idx_customer_payments_customer ON customer_payments(customer_id);

ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON customer_payments
  FOR ALL USING (org_id = public.user_org_id());


-- 5. customer_payment_applications ----------------------------
-- One row per (payment, invoice) combination — records how much of
-- a payment was applied to a given invoice.

CREATE TABLE customer_payment_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE RESTRICT,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id, invoice_id)
);

CREATE INDEX idx_customer_payment_apps_payment ON customer_payment_applications(payment_id);
CREATE INDEX idx_customer_payment_apps_invoice ON customer_payment_applications(invoice_id);

ALTER TABLE customer_payment_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON customer_payment_applications
  FOR ALL USING (
    payment_id IN (SELECT id FROM customer_payments WHERE org_id = public.user_org_id())
  );


-- 6. Helper functions -----------------------------------------

-- A/R balance for a single customer: positive = owes us, negative = credit on account.
CREATE OR REPLACE FUNCTION customer_balance(p_customer_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    (SELECT SUM(total) FROM customer_invoices
       WHERE customer_id = p_customer_id AND status != 'void'), 0
  ) - COALESCE(
    (SELECT SUM(amount) FROM customer_payments
       WHERE customer_id = p_customer_id), 0
  );
$$ LANGUAGE SQL STABLE;


-- Recompute an invoice's status based on payment applications.
CREATE OR REPLACE FUNCTION recalculate_invoice_status(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_applied NUMERIC;
BEGIN
  SELECT * INTO v_invoice FROM customer_invoices WHERE id = p_invoice_id;
  IF NOT FOUND OR v_invoice.status = 'void' OR v_invoice.kind = 'credit_note' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_applied
    FROM customer_payment_applications
    WHERE invoice_id = p_invoice_id;

  IF v_applied >= v_invoice.total THEN
    UPDATE customer_invoices SET status = 'paid', updated_at = now()
      WHERE id = p_invoice_id AND status != 'paid';
  ELSIF v_applied > 0 THEN
    UPDATE customer_invoices SET status = 'partial', updated_at = now()
      WHERE id = p_invoice_id AND status != 'partial';
  ELSE
    UPDATE customer_invoices SET status = 'open', updated_at = now()
      WHERE id = p_invoice_id AND status != 'open';
  END IF;
END;
$$;


-- Atomic: create an invoice (or credit note) with line items.
-- Allocates the next invoice number for the org via the counter table.
CREATE OR REPLACE FUNCTION create_customer_invoice(
  p_org_id      UUID,
  p_customer_id UUID,
  p_kind        TEXT,                -- 'invoice' or 'credit_note'
  p_issued_at   TIMESTAMPTZ,
  p_due_at      TIMESTAMPTZ,
  p_notes       TEXT,
  p_order_id    UUID,
  p_line_items  JSONB                -- [{description, quantity, unit_price, product_id?, order_item_id?}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id     UUID;
  v_invoice_number TEXT;
  v_counter        INTEGER;
  v_year           TEXT;
  v_subtotal       NUMERIC := 0;
  v_total          NUMERIC;
  v_line           RECORD;
BEGIN
  -- 1. Allocate next invoice number for this org
  INSERT INTO customer_invoice_counters (org_id, next_value)
  VALUES (p_org_id, 1)
  ON CONFLICT (org_id) DO UPDATE
    SET next_value = customer_invoice_counters.next_value + 1
  RETURNING next_value INTO v_counter;

  v_year := to_char(COALESCE(p_issued_at, now()), 'YYYY');
  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_counter::text, 4, '0');

  -- 2. Compute subtotal from line items
  IF p_line_items IS NOT NULL THEN
    SELECT COALESCE(SUM(
      (value->>'quantity')::numeric * (value->>'unit_price')::numeric
    ), 0) INTO v_subtotal
    FROM jsonb_array_elements(p_line_items);
  END IF;

  v_total := CASE WHEN p_kind = 'credit_note' THEN -ABS(v_subtotal) ELSE ABS(v_subtotal) END;

  -- 3. Insert invoice header
  INSERT INTO customer_invoices (
    org_id, customer_id, invoice_number, kind, status,
    issued_at, due_at, subtotal, total, notes, order_id
  ) VALUES (
    p_org_id, p_customer_id, v_invoice_number, p_kind, 'open',
    COALESCE(p_issued_at, now()), p_due_at,
    ABS(v_subtotal), v_total, p_notes, p_order_id
  )
  RETURNING id INTO v_invoice_id;

  -- 4. Insert line items
  IF p_line_items IS NOT NULL THEN
    FOR v_line IN
      SELECT
        (value->>'description')                          AS description,
        (value->>'quantity')::numeric                    AS quantity,
        (value->>'unit_price')::numeric                  AS unit_price,
        NULLIF(value->>'product_id',    '')::uuid        AS product_id,
        NULLIF(value->>'order_item_id', '')::uuid        AS order_item_id
      FROM jsonb_array_elements(p_line_items)
    LOOP
      INSERT INTO customer_invoice_line_items (
        invoice_id, description, quantity, unit_price, amount,
        product_id, order_item_id
      ) VALUES (
        v_invoice_id, v_line.description, v_line.quantity, v_line.unit_price,
        v_line.quantity * v_line.unit_price, v_line.product_id, v_line.order_item_id
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'invoice_id',     v_invoice_id,
    'invoice_number', v_invoice_number,
    'total',          v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION create_customer_invoice(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_customer_invoice(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB)
  TO service_role;


-- Atomic: record a customer payment + apply to invoices in one txn.
CREATE OR REPLACE FUNCTION record_customer_payment(
  p_org_id           UUID,
  p_customer_id      UUID,
  p_amount           NUMERIC,
  p_method           TEXT,
  p_reference_number TEXT,
  p_notes            TEXT,
  p_received_at      TIMESTAMPTZ,
  p_recorded_by      UUID,
  p_applications     JSONB              -- [{invoice_id: uuid, amount: numeric}, ...] (may be NULL/empty)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
  v_app_total  NUMERIC := 0;
  v_app        RECORD;
BEGIN
  -- Validate that applications don't exceed the payment amount.
  IF p_applications IS NOT NULL AND jsonb_typeof(p_applications) = 'array' THEN
    SELECT COALESCE(SUM((value->>'amount')::numeric), 0)
      INTO v_app_total
      FROM jsonb_array_elements(p_applications);
    IF v_app_total > p_amount THEN
      RAISE EXCEPTION 'Applications total $% exceeds payment amount $%',
        v_app_total, p_amount;
    END IF;
  END IF;

  -- 1. Create the payment row
  INSERT INTO customer_payments (
    org_id, customer_id, amount, method, reference_number,
    notes, received_at, recorded_by
  ) VALUES (
    p_org_id, p_customer_id, p_amount, p_method, p_reference_number,
    p_notes, COALESCE(p_received_at, now()), p_recorded_by
  )
  RETURNING id INTO v_payment_id;

  -- 2. Apply to invoices and recompute their statuses.
  IF p_applications IS NOT NULL AND jsonb_typeof(p_applications) = 'array' THEN
    FOR v_app IN
      SELECT (value->>'invoice_id')::uuid AS invoice_id,
             (value->>'amount')::numeric  AS amount
        FROM jsonb_array_elements(p_applications)
    LOOP
      INSERT INTO customer_payment_applications (payment_id, invoice_id, amount)
      VALUES (v_payment_id, v_app.invoice_id, v_app.amount);
      PERFORM recalculate_invoice_status(v_app.invoice_id);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('payment_id', v_payment_id);
END;
$$;

REVOKE ALL ON FUNCTION record_customer_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_customer_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, JSONB)
  TO service_role;


-- Void an invoice (only if no payments are applied).
CREATE OR REPLACE FUNCTION void_customer_invoice(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applied NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_applied
    FROM customer_payment_applications
    WHERE invoice_id = p_invoice_id;
  IF v_applied > 0 THEN
    RAISE EXCEPTION 'Cannot void an invoice with applied payments. Reverse the payments first.';
  END IF;
  UPDATE customer_invoices SET status = 'void', updated_at = now()
    WHERE id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION void_customer_invoice(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION void_customer_invoice(UUID) TO service_role;


-- 7. Auto-create invoice when an order moves to status='confirmed' --

CREATE OR REPLACE FUNCTION auto_create_order_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing   UUID;
  v_line_items JSONB;
BEGIN
  -- Only act on transitions into 'confirmed'.
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Walk-in orders (no customer link) can't be invoiced.
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Already invoiced?
  SELECT id INTO v_existing FROM customer_invoices WHERE order_id = NEW.id LIMIT 1;
  IF FOUND THEN
    RETURN NEW;
  END IF;

  -- Build line items from order_items.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'description',   COALESCE(p.name, 'Item'),
           'quantity',      oi.quantity,
           'unit_price',    oi.unit_price,
           'product_id',    oi.product_id::text,
           'order_item_id', oi.id::text
         )), '[]'::jsonb)
    INTO v_line_items
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
   WHERE oi.order_id = NEW.id;

  IF jsonb_array_length(v_line_items) = 0 THEN
    RETURN NEW;
  END IF;

  PERFORM create_customer_invoice(
    NEW.org_id,
    NEW.customer_id,
    'invoice',
    now(),
    NULL,
    'Auto-generated from order ' || NEW.order_number,
    NEW.id,
    v_line_items
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_order_invoice
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_create_order_invoice();


-- 8. Backfill: invoice existing confirmed-or-later orders ----
-- One-time pass for orders that pre-date this migration.

DO $$
DECLARE
  v_order RECORD;
  v_line_items JSONB;
BEGIN
  FOR v_order IN
    SELECT o.* FROM orders o
    WHERE o.customer_id IS NOT NULL
      AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered')
      AND NOT EXISTS (SELECT 1 FROM customer_invoices ci WHERE ci.order_id = o.id)
  LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'description',   COALESCE(p.name, 'Item'),
             'quantity',      oi.quantity,
             'unit_price',    oi.unit_price,
             'product_id',    oi.product_id::text,
             'order_item_id', oi.id::text
           )), '[]'::jsonb)
      INTO v_line_items
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = v_order.id;

    IF jsonb_array_length(v_line_items) > 0 THEN
      PERFORM create_customer_invoice(
        v_order.org_id,
        v_order.customer_id,
        'invoice',
        v_order.ordered_at,
        NULL,
        'Backfilled from order ' || v_order.order_number,
        v_order.id,
        v_line_items
      );
    END IF;
  END LOOP;
END;
$$;


-- 9. Permissions ----------------------------------------------

INSERT INTO permissions (code, category, name, description) VALUES
  ('customer_billing.view',   'Customer Billing',
   'View Customer Billing',
   'View customer invoices, payments, and balances'),
  ('customer_billing.manage', 'Customer Billing',
   'Manage Customer Billing',
   'Create invoices, record payments, issue credits, and void invoices');

-- Tie these to the orders module (where the Receivables page lives).
UPDATE permissions SET module_slug = 'orders' WHERE code LIKE 'customer_billing.%';

-- NOTE: Role-permission grants for new permissions are in seed.sql.
