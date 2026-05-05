-- ============================================================
-- Plan versioning: every edit to a plan creates a version
-- snapshot. Existing subscribers stay on their version until
-- explicitly migrated. New subscribers get the latest version.
-- ============================================================

-- 1. Plan versions table — immutable snapshots of plan state
CREATE TABLE plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version INT NOT NULL,                        -- 1, 2, 3, ...
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL,
  price_yearly NUMERIC(10,2),
  max_users INT,
  max_batches_per_month INT,
  included_modules TEXT[] DEFAULT '{}',
  change_notes TEXT,                           -- what changed in this version
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, version)
);

ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_versions_read_all" ON plan_versions FOR SELECT USING (true);

-- 2. Add current_version to plans table
ALTER TABLE plans ADD COLUMN current_version INT NOT NULL DEFAULT 1;

-- 3. Add plan_version_id to org_subscriptions so we know which
--    version a subscriber is locked to
ALTER TABLE org_subscriptions ADD COLUMN plan_version_id UUID REFERENCES plan_versions(id);

-- 4. Seed version 1 for each existing plan
INSERT INTO plan_versions (plan_id, version, name, description, price_monthly, price_yearly, max_users, max_batches_per_month, included_modules, change_notes)
SELECT id, 1, name, description, price_monthly, price_yearly, max_users, max_batches_per_month, included_modules, 'Initial version'
FROM plans;
