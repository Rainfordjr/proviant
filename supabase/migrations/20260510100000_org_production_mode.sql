-- Per-org default for how batches record material consumption.
--   'controlled'  = scan-as-you-go enforcement (real-time UI)
--   'after_action' = bulk-entry form filled in after the run
-- Both modes write to batch_ingredients and run identical server-side
-- substitution validation; only the input UX differs.

ALTER TABLE organizations
  ADD COLUMN production_mode TEXT NOT NULL DEFAULT 'after_action'
    CHECK (production_mode IN ('controlled', 'after_action'));
