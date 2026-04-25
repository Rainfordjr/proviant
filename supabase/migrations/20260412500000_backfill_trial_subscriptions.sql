-- ============================================================
-- Backfill: give every existing org a 14-day free trial
-- subscription if they don't already have one.
-- ============================================================

INSERT INTO org_subscriptions (org_id, billing_type, custom_rate_monthly, custom_notes, billing_cycle, status, trial_ends_at, current_period_start, current_period_end)
SELECT
  o.id,
  'custom',
  0,
  'Free 14-day trial',
  'monthly',
  'trial',
  now() + INTERVAL '14 days',
  now(),
  now() + INTERVAL '14 days'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM org_subscriptions s WHERE s.org_id = o.id
);
