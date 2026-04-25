-- Add quarterly and yearly recurrence options to tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_recurrence_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_check
  CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly'));
