-- ============================================================
-- API keys for headless / programmatic access.
--
-- Each org can mint one or more API keys. A key has:
--   - a name (operator-facing label)
--   - a list of permission scopes (matches our permission codes,
--     "*" for full access)
--   - a prefix (first 8 chars of the key, indexed for fast lookup)
--   - a SHA-256 hash of the full key
--   - a revoked_at timestamp (soft-delete; we never re-issue)
--
-- The full key is shown to the operator ONCE at creation; only
-- the prefix and hash are persisted.
--
-- All access is gated through the service-role-only API routes
-- (no PostgREST exposure).
-- ============================================================

CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_prefix    TEXT NOT NULL UNIQUE,    -- first 8 chars (e.g. "pk_a1b2c3")
  key_hash      TEXT NOT NULL,           -- sha256 of full key
  scopes        TEXT[] NOT NULL DEFAULT '{}',  -- permission codes; ["*"] = wildcard
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  notes         TEXT
);

CREATE INDEX idx_api_keys_org      ON api_keys(org_id);
CREATE INDEX idx_api_keys_prefix   ON api_keys(key_prefix);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only via API routes.
REVOKE ALL ON TABLE api_keys FROM PUBLIC, anon, authenticated;
GRANT  ALL ON TABLE api_keys TO   service_role;


-- New permission for managing keys (gated for the management routes).
INSERT INTO permissions (code, category, name, description) VALUES
  ('api_keys.manage', 'API Access', 'Manage API Keys',
   'Create, list, and revoke API keys for the organization');
