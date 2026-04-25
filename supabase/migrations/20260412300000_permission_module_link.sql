-- ============================================================
-- Link permissions to modules so we can hide permissions for
-- inactive modules, and add a modules.manage permission.
-- ============================================================

-- 1. Add module_slug column to permissions
ALTER TABLE permissions ADD COLUMN module_slug TEXT REFERENCES modules(slug);

-- 2. Map existing permissions to their module slugs
UPDATE permissions SET module_slug = 'recipes'           WHERE code LIKE 'recipes.%';
UPDATE permissions SET module_slug = 'products'          WHERE code LIKE 'products.%';
UPDATE permissions SET module_slug = 'batches'           WHERE code LIKE 'batches.%';
UPDATE permissions SET module_slug = 'materials'         WHERE code LIKE 'materials.%';
UPDATE permissions SET module_slug = 'orders'            WHERE code LIKE 'orders.%';
UPDATE permissions SET module_slug = 'customers'         WHERE code LIKE 'customers.%';
UPDATE permissions SET module_slug = 'compliance'        WHERE code LIKE 'compliance.%';
UPDATE permissions SET module_slug = 'development'       WHERE code LIKE 'development.%';
UPDATE permissions SET module_slug = 'inventory-mapping' WHERE code LIKE 'warehouse.%';

-- Core/global permissions (inventory, suppliers, users, roles, settings) have no module_slug
-- so they always show regardless of active modules.

-- 3. Add modules.manage permission
INSERT INTO permissions (code, category, name, description, module_slug) VALUES
  ('modules.manage', 'Modules', 'Manage Modules', 'Activate and deactivate modules for the organization', NULL);
