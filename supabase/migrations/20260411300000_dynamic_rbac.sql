-- ============================================================
-- Proviant: Dynamic Role-Based Access Control (RBAC)
--
-- Admin can create custom roles, assign permissions to roles,
-- and assign roles to users. Admin role has full access.
-- ============================================================

-- ============================================================
-- 1. PERMISSIONS (every possible action in the system)
-- ============================================================
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

-- Seed all permissions
INSERT INTO permissions (code, category, name, description) VALUES
  -- Recipes
  ('recipes.view',    'Recipes', 'View Recipes',       'View recipe list and details'),
  ('recipes.create',  'Recipes', 'Create Recipes',     'Create new recipes'),
  ('recipes.edit',    'Recipes', 'Edit Recipes',       'Edit recipe drafts and details'),
  ('recipes.delete',  'Recipes', 'Delete Recipes',     'Delete recipes'),
  ('recipes.submit',  'Recipes', 'Submit for Review',  'Submit recipe versions for approval'),
  ('recipes.approve', 'Recipes', 'Approve/Reject',     'Approve or reject recipe versions'),

  -- Products
  ('products.view',   'Products', 'View Products',     'View product list and details'),
  ('products.create', 'Products', 'Create Products',   'Create new products'),
  ('products.edit',   'Products', 'Edit Products',     'Edit product details and components'),
  ('products.delete', 'Products', 'Delete Products',   'Delete products'),

  -- Batches
  ('batches.view',    'Batches', 'View Batches',       'View batch list and details'),
  ('batches.create',  'Batches', 'Create Batches',     'Create new production batches'),
  ('batches.edit',    'Batches', 'Edit Batches',       'Update batch status and details'),
  ('batches.delete',  'Batches', 'Delete Batches',     'Delete batches'),

  -- Materials
  ('materials.view',   'Materials', 'View Materials',   'View raw materials and lots'),
  ('materials.create', 'Materials', 'Create Materials', 'Add new raw materials'),
  ('materials.edit',   'Materials', 'Edit Materials',   'Edit material details and stock'),
  ('materials.delete', 'Materials', 'Delete Materials', 'Delete raw materials'),

  -- Orders
  ('orders.view',   'Orders', 'View Orders',           'View order list and details'),
  ('orders.create', 'Orders', 'Create Orders',         'Create new orders'),
  ('orders.edit',   'Orders', 'Edit Orders',           'Edit order details and status'),
  ('orders.delete', 'Orders', 'Delete Orders',         'Delete orders'),

  -- Compliance
  ('compliance.view',   'Compliance', 'View Compliance',   'View compliance logs and HACCP plans'),
  ('compliance.create', 'Compliance', 'Log Compliance',    'Record compliance entries'),
  ('compliance.edit',   'Compliance', 'Edit Compliance',   'Edit compliance logs and plans'),
  ('compliance.manage', 'Compliance', 'Manage HACCP',      'Create and manage HACCP plans'),

  -- Inventory
  ('inventory.view',   'Inventory', 'View Inventory',     'View stock levels and purchase orders'),
  ('inventory.manage', 'Inventory', 'Manage Inventory',   'Create POs, receive stock, adjust levels'),

  -- Development (R&D)
  ('development.view',   'Development', 'View R&D',       'View development projects and test batches'),
  ('development.create', 'Development', 'Create R&D',     'Create development projects and test batches'),
  ('development.edit',   'Development', 'Edit R&D',       'Edit projects, log notes on test batches'),

  -- Suppliers
  ('suppliers.view',   'Suppliers', 'View Suppliers',     'View supplier list'),
  ('suppliers.create', 'Suppliers', 'Create Suppliers',   'Add new suppliers'),
  ('suppliers.edit',   'Suppliers', 'Edit Suppliers',     'Edit supplier details'),

  -- Users & Roles (admin only by default)
  ('users.view',   'Users & Roles', 'View Users',        'View user list'),
  ('users.create', 'Users & Roles', 'Invite Users',      'Invite new users to the organization'),
  ('users.edit',   'Users & Roles', 'Edit Users',        'Edit user profiles and role assignments'),
  ('users.delete', 'Users & Roles', 'Remove Users',      'Remove users from the organization'),
  ('roles.view',   'Users & Roles', 'View Roles',        'View role list and permissions'),
  ('roles.create', 'Users & Roles', 'Create Roles',      'Create custom roles'),
  ('roles.edit',   'Users & Roles', 'Edit Roles',        'Edit role permissions'),
  ('roles.delete', 'Users & Roles', 'Delete Roles',      'Delete custom roles'),

  -- Settings
  ('settings.view', 'Settings', 'View Settings',         'View organization settings'),
  ('settings.edit', 'Settings', 'Edit Settings',         'Edit organization settings');


-- ============================================================
-- 2. ROLES (per-organization, admin creates custom roles)
-- ============================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_roles_org_id ON roles(org_id);

-- ============================================================
-- 3. ROLE PERMISSIONS (which permissions each role has)
-- ============================================================
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

-- ============================================================
-- 4. USER ROLES (which roles each user has — can have multiple)
-- ============================================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- ============================================================
-- 5. HELPER FUNCTION: check if current user has a permission
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_has_permission(perm_code TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND (r.is_admin = true OR p.code = perm_code)
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
-- Permissions are global (read-only, no org scoping)
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read permissions" ON permissions
  FOR SELECT USING (true);

-- Roles: tenant isolation
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON roles
  FOR ALL USING (org_id = public.user_org_id());

-- Role permissions: through parent role
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via parent" ON role_permissions
  FOR ALL USING (
    role_id IN (SELECT id FROM roles WHERE org_id = public.user_org_id())
  );

-- User roles: through user's org
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access via org" ON user_roles
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE org_id = public.user_org_id())
  );

-- ============================================================
-- 7. AUTO-UPDATE TIMESTAMPS
-- ============================================================
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
