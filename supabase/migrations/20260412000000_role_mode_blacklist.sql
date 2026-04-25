-- ============================================================
-- Proviant: Role Mode (whitelist / blacklist)
-- ============================================================
-- whitelist (default): user has ONLY the permissions listed in role_permissions
-- blacklist: user has ALL permissions EXCEPT those listed in role_permissions

ALTER TABLE roles
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'whitelist'
    CHECK (mode IN ('whitelist', 'blacklist'));

-- Replace the permission check function to handle both modes
CREATE OR REPLACE FUNCTION public.user_has_permission(perm_code TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND (
        -- Admin roles bypass everything
        r.is_admin = true
        -- Whitelist: permission must be explicitly granted
        OR (r.mode = 'whitelist' AND EXISTS (
          SELECT 1
          FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
          WHERE rp.role_id = r.id AND p.code = perm_code
        ))
        -- Blacklist: permission must NOT be in the exclusion list
        OR (r.mode = 'blacklist' AND NOT EXISTS (
          SELECT 1
          FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
          WHERE rp.role_id = r.id AND p.code = perm_code
        ))
      )
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
