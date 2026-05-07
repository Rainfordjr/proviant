-- Delivery routes: group customers into named delivery runs with ordered stops

CREATE TABLE delivery_routes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  day_of_week  text,
  driver_name  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE delivery_route_stops (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id    uuid NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stop_order  integer NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, customer_id)
);

ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON delivery_routes
  FOR ALL USING (org_id = public.user_org_id());

CREATE POLICY "Tenant isolation" ON delivery_route_stops
  FOR ALL USING (org_id = public.user_org_id());

CREATE INDEX idx_delivery_routes_org_id ON delivery_routes(org_id);
CREATE INDEX idx_delivery_route_stops_route_id ON delivery_route_stops(route_id);
CREATE INDEX idx_delivery_route_stops_customer_id ON delivery_route_stops(customer_id);

CREATE TRIGGER set_delivery_routes_updated_at
  BEFORE UPDATE ON delivery_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
