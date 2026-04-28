-- ============================================================
-- Atomic order creation.
--
-- The new-order UI does an `orders` insert followed by
-- `order_items` inserts. If the items step fails partway, you
-- get an order header with no items. This function does the
-- whole sequence in one transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_org_id          UUID,
  p_order_number    TEXT,
  p_customer_id     UUID,            -- NULL for walk-in
  p_customer_name   TEXT,
  p_customer_email  TEXT,
  p_status          TEXT,            -- defaults to 'pending' if NULL
  p_notes           TEXT,
  p_ordered_at      TIMESTAMPTZ,     -- defaults to now() if NULL
  p_items           JSONB            -- [{product_id, quantity, unit_price, batch_id?}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_item     RECORD;
  v_status   TEXT := COALESCE(p_status, 'pending');
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- 1. Insert order header
  INSERT INTO orders (
    org_id, order_number, customer_id, customer_name, customer_email,
    status, notes, ordered_at
  ) VALUES (
    p_org_id, p_order_number, p_customer_id, p_customer_name,
    p_customer_email, v_status, p_notes,
    COALESCE(p_ordered_at, now())
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert line items
  FOR v_item IN
    SELECT
      (value->>'product_id')::uuid                        AS product_id,
      (value->>'quantity')::numeric                       AS quantity,
      COALESCE((value->>'unit_price')::numeric, 0)        AS unit_price,
      NULLIF(value->>'batch_id', '')::uuid                AS batch_id
    FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, batch_id)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.batch_id);
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION create_order_with_items(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_order_with_items(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB)
  TO service_role;
