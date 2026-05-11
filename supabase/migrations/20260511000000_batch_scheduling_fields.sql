-- The /production-schedule UI (calendar, batch-planning-modal, batch-chip,
-- resource-panel, batch-detail-panel) was built against batch columns that
-- never existed in the schema. Adding them here so the existing UI works
-- without rewriting it.
--
-- scheduled_date is a calendar-day-level field used by the schedule's day
-- and week views. scheduled_for (added earlier for the satellite queue) is
-- the precise timestamp. The planning modal writes both so either side of
-- the app surfaces the batch consistently.

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS estimated_duration_hours NUMERIC;

CREATE INDEX IF NOT EXISTS idx_batches_assigned_to ON batches(assigned_to);
CREATE INDEX IF NOT EXISTS idx_batches_scheduled_date ON batches(scheduled_date);
