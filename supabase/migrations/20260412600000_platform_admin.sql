-- ============================================================
-- Platform super-admin flag on users table.
-- This is separate from per-org admin roles — it grants
-- cross-org access to the /admin panel.
-- ============================================================

ALTER TABLE users ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT false;

-- Mark the earliest-created admin user as a platform admin.
-- You can grant this to other users later via SQL or the admin panel.
UPDATE users SET is_platform_admin = true
WHERE id = (
  SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
);
