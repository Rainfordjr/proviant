-- ============================================================
-- Proviant: Seed Data for Local Development
-- ============================================================

-- Extensions required by this seed. pgcrypto is used for the admin
-- password hash below (crypt + gen_salt). On Supabase Cloud, extensions
-- live in the `extensions` schema; install there (creating the schema
-- first if a reset wiped it) and make sure the search_path can see it.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path TO public, extensions, auth;

-- Create a demo organization
INSERT INTO organizations (id, name, plan_tier, upc_prefix, gtin_prefix) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Billy''s Bakery', 'pro', '0123456', '0012345');

-- ============================================================
-- SEED AUTH USER (platform super-admin)
-- Email: admin@proviant.dev  |  Password: admin123
-- ============================================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin@proviant.dev',
  extensions.crypt('admin123', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Billy Rainford","org_name":"Billy''s Bakery"}',
  '', '', '', '',
  false
);

-- Auth identity (required for Supabase email login to work)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'c0000000-0000-0000-0000-000000000001', 'email', 'admin@proviant.dev', 'email_verified', true),
  'email',
  'c0000000-0000-0000-0000-000000000001',
  now(), now(), now()
);

-- User profile (linked to Billy's Bakery, platform admin)
INSERT INTO users (id, org_id, email, full_name, role, is_platform_admin) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'admin@proviant.dev', 'Billy Rainford', 'admin', true);

-- NOTE: user_roles assignment for this user is in the RBAC section below,
-- after the Administrator role is created.

-- Suppliers
INSERT INTO suppliers (id, org_id, name, contact_name, email, phone, account_number, payment_terms) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Pacific NW Flour Co.', 'Sarah Chen', 'sarah@pnwflour.com', '206-555-0101', 'PNW-4821', 'Net 30'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Cascade Dairy', 'Mike Johnson', 'mike@cascadedairy.com', '206-555-0102', 'CD-10073', 'Net 15'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Mountain Sugar Supply', 'Lisa Park', 'lisa@mountainsugar.com', '425-555-0103', 'MSS-2299', 'Net 30'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Choco Source Inc.', 'Tom Baker', 'tom@chocosource.com', '503-555-0104', 'CSI-0587', '2/10 Net 30'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Olympic Dairy Co.', 'Jenna Wallace', 'jenna@olympicdairy.com', '360-555-0105', 'OLY-3041', 'Net 15'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Northwest Baking Supply', 'Eric Park', 'eric@nwbaking.com', '425-555-0106', 'NWB-7702', 'Net 30');

-- Ingredients (abstract, reused across vendor SKUs)
INSERT INTO ingredients (id, org_id, name, unit, allergens) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'All-Purpose Flour',    'lbs',     '{wheat}'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Whole Wheat Flour',    'lbs',     '{wheat}'),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Bread Flour',          'lbs',     '{wheat}'),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Whole Milk',           'gallons', '{milk}'),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Butter (unsalted)',    'lbs',     '{milk}'),
  ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Granulated Sugar',     'lbs',     '{}'),
  ('f0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Active Dry Yeast',     'lbs',     '{}'),
  ('f0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Cinnamon (ground)',    'lbs',     '{}'),
  ('f0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Rye Flour',            'lbs',     '{wheat}'),
  ('f0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Salt',                 'lbs',     '{}'),
  ('f0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Chocolate Chips',      'lbs',     '{milk,soy}'),
  ('f0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'Eggs',                 'dozen',   '{eggs}'),
  ('f0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'Baking Powder',        'lbs',     '{}'),
  ('f0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'Vanilla Extract',      'oz',      '{}'),
  ('f0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'Blueberries (frozen)', 'lbs',     '{}'),
  ('f0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'Poppy Seeds',          'lbs',     '{}'),
  ('f0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001', 'Lemon Zest (dried)',   'lbs',     '{}'),
  ('f0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001', 'Lemon Juice',          'oz',      '{}');

-- Raw Materials (vendor SKUs that satisfy ingredients)
INSERT INTO raw_materials (
  id, org_id, ingredient_id, name, vendor_name, item_code, supplier_id, unit, category, item_type, brand,
  cost, packaging_size, storage_requirements, shelf_life_qty, shelf_life_unit,
  opened_shelf_life_qty, opened_shelf_life_unit, reorder_point, current_stock
) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001',
   'All-Purpose Flour', 'PNW All-Purpose Unbleached Flour', 'RM10001',
   'b0000000-0000-0000-0000-000000000001', 'lbs', 'Raw Material', 'Flour', 'Pacific NW',
   18.50, '50 lb', 'Ambient', 12, 'Months', 6, 'Months', 100, 500),

  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002',
   'Whole Wheat Flour', 'PNW Whole Wheat Stone-Ground', 'RM10002',
   'b0000000-0000-0000-0000-000000000001', 'lbs', 'Raw Material', 'Flour', 'Pacific NW',
   22.00, '50 lb', 'Ambient', 10, 'Months', 4, 'Months', 75, 120),

  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000003',
   'Bread Flour', 'PNW High-Gluten Bread Flour', 'RM10003',
   'b0000000-0000-0000-0000-000000000001', 'lbs', 'Raw Material', 'Flour', 'Pacific NW',
   20.00, '50 lb', 'Ambient', 12, 'Months', 6, 'Months', 100, 180),

  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000004',
   'Whole Milk', 'Cascade Grade A Whole Milk', 'RM10010',
   'b0000000-0000-0000-0000-000000000002', 'gallons', 'Raw Material', 'Dairy', 'Cascade',
   4.25, '1 gal', 'Refrigerated', 14, 'Days', 7, 'Days', 20, 15),

  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000005',
   'Butter (unsalted)', 'Cascade Unsalted Butter 83%', 'RM10011',
   'b0000000-0000-0000-0000-000000000002', 'lbs', 'Raw Material', 'Dairy', 'Cascade',
   5.80, '1 lb block', 'Refrigerated', 6, 'Months', 14, 'Days', 30, 45),

  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000006',
   'Granulated Sugar', 'Mountain Pure Cane Sugar', 'RM10020',
   'b0000000-0000-0000-0000-000000000003', 'lbs', 'Raw Material', 'Sugar', 'Mountain',
   28.00, '50 lb', 'Ambient', 24, 'Months', NULL, NULL, 50, 200),

  ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000007',
   'Active Dry Yeast', 'PNW Active Dry Yeast', 'RM10004',
   'b0000000-0000-0000-0000-000000000001', 'lbs', 'Raw Material', 'Leavening', 'Pacific NW',
   12.00, '2 lb', 'Ambient', 18, 'Months', 4, 'Months', 5, 8),

  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000008',
   'Cinnamon (ground)', 'Mountain Premium Ground Cinnamon', 'RM10021',
   'b0000000-0000-0000-0000-000000000003', 'lbs', 'Raw Material', 'Spice', 'Mountain',
   15.50, '5 lb', 'Ambient', 36, 'Months', 12, 'Months', 3, 6),

  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000009',
   'Rye Flour', 'PNW Medium Rye Flour', 'RM10005',
   'b0000000-0000-0000-0000-000000000001', 'lbs', 'Raw Material', 'Flour', 'Pacific NW',
   24.00, '50 lb', 'Ambient', 10, 'Months', 4, 'Months', 40, 25),

  ('d0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000010',
   'Salt', 'Mountain Fine Sea Salt', 'RM10022',
   'b0000000-0000-0000-0000-000000000003', 'lbs', 'Raw Material', 'Seasoning', 'Mountain',
   8.00, '25 lb', 'Ambient', 60, 'Months', NULL, NULL, 10, 22),

  ('d0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000011',
   'Chocolate Chips', 'Choco Source Semi-Sweet Chips', 'RM10030',
   'b0000000-0000-0000-0000-000000000004', 'lbs', 'Raw Material', 'Chocolate', 'Choco Source',
   6.50, '10 lb', 'Ambient', 18, 'Months', 6, 'Months', 50, 150),

  ('d0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000012',
   'Eggs', 'Cascade Large Grade AA Eggs', 'RM10012',
   'b0000000-0000-0000-0000-000000000002', 'dozen', 'Raw Material', 'Dairy', 'Cascade',
   3.80, '15 dozen case', 'Refrigerated', 28, 'Days', NULL, NULL, 20, 30),

  ('d0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000013',
   'Baking Powder', 'Mountain Double-Acting Baking Powder', 'RM10023',
   'b0000000-0000-0000-0000-000000000003', 'lbs', 'Raw Material', 'Leavening', 'Mountain',
   6.00, '5 lb', 'Ambient', 18, 'Months', 6, 'Months', 5, 12),

  ('d0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000014',
   'Vanilla Extract', 'Mountain Pure Vanilla Extract', 'RM10024',
   'b0000000-0000-0000-0000-000000000003', 'oz', 'Raw Material', 'Flavoring', 'Mountain',
   2.50, '16 oz bottle', 'Ambient', 48, 'Months', 12, 'Months', 20, 48),

  ('d0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000015',
   'Blueberries (frozen)', 'Pacific NW IQF Blueberries', 'RM10031',
   'b0000000-0000-0000-0000-000000000001', 'lbs', 'Raw Material', 'Fruit', 'Pacific NW',
   4.50, '10 lb bag', 'Frozen', 18, 'Months', 3, 'Days', 30, 80),

  ('d0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000016',
   'Poppy Seeds', 'Mountain Whole Poppy Seeds', 'RM10025',
   'b0000000-0000-0000-0000-000000000003', 'lbs', 'Raw Material', 'Seed', 'Mountain',
   14.00, '5 lb', 'Ambient', 24, 'Months', 6, 'Months', 3, 10),

  ('d0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000017',
   'Lemon Zest (dried)', 'Mountain Dried Lemon Zest', 'RM10026',
   'b0000000-0000-0000-0000-000000000003', 'lbs', 'Raw Material', 'Flavoring', 'Mountain',
   18.00, '2 lb', 'Ambient', 24, 'Months', 6, 'Months', 2, 5),

  ('d0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000018',
   'Lemon Juice', 'Cascade Fresh-Squeezed Lemon Juice', 'RM10027',
   'b0000000-0000-0000-0000-000000000002', 'oz', 'Raw Material', 'Flavoring', 'Cascade',
   0.25, '32 oz bottle', 'Refrigerated', 21, 'Days', 7, 'Days', 10, 64),

  -- Alternate-vendor SKUs that satisfy the same ingredients (substitution demo)
  ('d0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000005',
   'Butter (unsalted) - PNW', 'PNW European-Style Unsalted Butter', 'RM10011-ALT',
   'b0000000-0000-0000-0000-000000000001', 'lbs', 'Raw Material', 'Dairy', 'Pacific NW',
   6.40, '1 lb block', 'Refrigerated', 6, 'Months', 14, 'Days', 30, 12),

  ('d0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001',
   'All-Purpose Flour - Mountain', 'Mountain All-Purpose Bleached Flour', 'RM10001-ALT',
   'b0000000-0000-0000-0000-000000000003', 'lbs', 'Raw Material', 'Flour', 'Mountain',
   17.00, '50 lb', 'Ambient', 12, 'Months', 6, 'Months', 100, 75),

  -- Olympic Dairy alts: milk, butter, eggs
  ('d0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000004',
   'Whole Milk - Olympic', 'Olympic Grass-Fed Whole Milk', 'RM10010-ALT',
   'b0000000-0000-0000-0000-000000000005', 'gallons', 'Raw Material', 'Dairy', 'Olympic',
   4.95, '1 gal', 'Refrigerated', 14, 'Days', 7, 'Days', 20, 9),

  ('d0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000005',
   'Butter (unsalted) - Olympic', 'Olympic Cultured Unsalted Butter', 'RM10011-ALT2',
   'b0000000-0000-0000-0000-000000000005', 'lbs', 'Raw Material', 'Dairy', 'Olympic',
   6.20, '1 lb block', 'Refrigerated', 6, 'Months', 14, 'Days', 30, 18),

  ('d0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000012',
   'Eggs - Olympic', 'Olympic Cage-Free Large Brown Eggs', 'RM10012-ALT',
   'b0000000-0000-0000-0000-000000000005', 'dozen', 'Raw Material', 'Dairy', 'Olympic',
   4.30, '15 dozen case', 'Refrigerated', 28, 'Days', NULL, NULL, 20, 22),

  -- Northwest Baking alts: sugar, salt, baking powder, vanilla, whole wheat flour
  ('d0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000006',
   'Granulated Sugar - NW Baking', 'NW Baking Pure Cane Sugar', 'RM10020-ALT',
   'b0000000-0000-0000-0000-000000000006', 'lbs', 'Raw Material', 'Sugar', 'NW Baking',
   26.50, '50 lb', 'Ambient', 24, 'Months', NULL, NULL, 50, 100),

  ('d0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000010',
   'Salt - NW Baking', 'NW Baking Kosher Salt', 'RM10022-ALT',
   'b0000000-0000-0000-0000-000000000006', 'lbs', 'Raw Material', 'Seasoning', 'NW Baking',
   7.50, '25 lb', 'Ambient', 60, 'Months', NULL, NULL, 10, 18),

  ('d0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000013',
   'Baking Powder - NW Baking', 'NW Baking Aluminum-Free Baking Powder', 'RM10023-ALT',
   'b0000000-0000-0000-0000-000000000006', 'lbs', 'Raw Material', 'Leavening', 'NW Baking',
   6.80, '5 lb', 'Ambient', 18, 'Months', 6, 'Months', 5, 8),

  ('d0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000014',
   'Vanilla Extract - NW Baking', 'NW Baking Madagascar Vanilla Extract', 'RM10024-ALT',
   'b0000000-0000-0000-0000-000000000006', 'oz', 'Raw Material', 'Flavoring', 'NW Baking',
   2.95, '16 oz bottle', 'Ambient', 48, 'Months', 12, 'Months', 20, 32),

  ('d0000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002',
   'Whole Wheat Flour - NW Baking', 'NW Baking Stone-Ground Whole Wheat', 'RM10002-ALT',
   'b0000000-0000-0000-0000-000000000006', 'lbs', 'Raw Material', 'Flour', 'NW Baking',
   21.00, '50 lb', 'Ambient', 10, 'Months', 4, 'Months', 75, 60);

-- Material Lots
INSERT INTO material_lots (id, material_id, org_id, lot_number, quantity, quantity_remaining, expiry_date, received_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'FL-2260-A', 500, 500, '2026-10-15', '2026-03-01'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'BF-2260-A', 300, 180, '2026-08-01', '2026-03-15'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'ML-2260', 30, 15, '2026-04-13', '2026-04-06'),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'BT-2260-A', 60, 45, '2026-06-01', '2026-03-20'),
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'SG-2260-A', 200, 200, '2027-01-01', '2026-03-10'),
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'CC-2260-A', 150, 150, '2027-03-01', '2026-04-01'),
  ('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'EG-2260-A', 30, 30, '2026-05-01', '2026-04-05'),
  -- Lots for alt-vendor SKUs (showing dual stock per ingredient)
  ('e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001', 'BT-PNW-2260', 12, 12, '2026-06-15', '2026-04-12'),
  ('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001', 'FL-MTN-2260', 75, 75, '2026-10-20', '2026-04-10'),
  ('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'ML-OLY-2260', 9, 9, '2026-04-22', '2026-04-15'),
  ('e0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', 'BT-OLY-2260', 18, 18, '2026-06-20', '2026-04-14'),
  ('e0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000001', 'EG-OLY-2260', 22, 22, '2026-05-08', '2026-04-15'),
  ('e0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000001', 'SG-NWB-2260', 100, 100, '2027-02-01', '2026-04-08'),
  ('e0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000001', 'BP-NWB-2260', 8, 8, '2026-09-01', '2026-04-09'),
  ('e0000000-0000-0000-0000-000000000015', 'd0000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000001', 'WW-NWB-2260', 60, 60, '2026-08-30', '2026-04-11');

-- ============================================================
-- RECIPES
-- ============================================================

-- Recipe: Chocolate Chip Muffin Top
INSERT INTO recipes (id, org_id, name, description, instructions, yield_quantity, yield_unit) VALUES
  ('aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Chocolate Chip Muffin Top',
   'Our signature chocolate chip muffin top. Crispy edges, chewy center.',
   '1. Cream butter and sugar together until fluffy.
2. Add eggs one at a time, then vanilla.
3. Mix dry ingredients separately (flour, baking powder, salt).
4. Fold dry into wet, do not overmix.
5. Fold in chocolate chips.
6. Scoop onto sheet pans in muffin-top molds.
7. Bake at 375°F for 12-14 minutes until golden edges.',
   100, 'each');

-- Recipe: Sourdough Loaf
INSERT INTO recipes (id, org_id, name, description, instructions, yield_quantity, yield_unit) VALUES
  ('aa000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Sourdough Loaf',
   'Classic sourdough bread with 24-hour fermentation.',
   '1. Autolyse: mix flour and water, rest 1 hour.
2. Add starter and salt, stretch and fold every 30 min x 4.
3. Bulk ferment 8-12 hours at room temp.
4. Shape and place in banneton.
5. Cold retard 12-16 hours.
6. Score and bake at 450°F in dutch oven, 20 min covered + 20 min uncovered.',
   24, 'loaves');

-- Recipe: Cinnamon Roll filling + dough
INSERT INTO recipes (id, org_id, name, description, instructions, yield_quantity, yield_unit) VALUES
  ('aa000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Cinnamon Roll',
   'Soft, pillowy cinnamon rolls with cream cheese frosting.',
   '1. Make enriched dough with flour, milk, butter, sugar, yeast, eggs.
2. Roll out dough, spread butter, cinnamon-sugar filling.
3. Roll tightly, cut into 12 pieces.
4. Proof until doubled.
5. Bake at 350°F for 22-25 minutes.
6. Top with cream cheese frosting while warm.',
   12, 'each');

-- Recipe: Blueberry Muffin Top
INSERT INTO recipes (id, org_id, name, description, instructions, yield_quantity, yield_unit) VALUES
  ('aa000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Blueberry Muffin Top',
   'Classic blueberry muffin top bursting with wild blueberries.',
   '1. Cream butter and sugar together until fluffy.
2. Add eggs one at a time, then vanilla.
3. Mix dry ingredients separately (flour, baking powder, salt).
4. Fold dry into wet, do not overmix.
5. Gently fold in frozen blueberries.
6. Scoop onto sheet pans in muffin-top molds.
7. Bake at 375°F for 14-16 minutes until golden.',
   100, 'each');

-- Recipe: Lemon Poppyseed Muffin Top
INSERT INTO recipes (id, org_id, name, description, instructions, yield_quantity, yield_unit) VALUES
  ('aa000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Lemon Poppyseed Muffin Top',
   'Bright, zesty lemon muffin top studded with poppy seeds.',
   '1. Cream butter and sugar together until fluffy.
2. Add eggs one at a time, then vanilla and lemon juice.
3. Mix dry ingredients separately (flour, baking powder, salt, poppy seeds, lemon zest).
4. Fold dry into wet, do not overmix.
5. Scoop onto sheet pans in muffin-top molds.
6. Bake at 375°F for 12-14 minutes until golden edges.',
   100, 'each');

-- Recipe Ingredients: Blueberry Muffin Top
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 25, 'lbs', 0),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', 12, 'lbs', 1),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000006', 14, 'lbs', 2),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000012', 5, 'dozen', 3),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000013', 0.5, 'lbs', 4),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000014', 4, 'oz', 5),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000010', 0.25, 'lbs', 6),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000015', 20, 'lbs', 7);

-- Recipe Ingredients: Lemon Poppyseed Muffin Top
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 25, 'lbs', 0),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000005', 12, 'lbs', 1),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000006', 15, 'lbs', 2),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000012', 5, 'dozen', 3),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000013', 0.5, 'lbs', 4),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000014', 4, 'oz', 5),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000010', 0.25, 'lbs', 6),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000016', 2, 'lbs', 7),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000017', 1, 'lbs', 8),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000018', 16, 'oz', 9);

-- Recipe Ingredients: Chocolate Chip Muffin Top
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 25, 'lbs', 0),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005', 12, 'lbs', 1),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000006', 15, 'lbs', 2),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000012', 5, 'dozen', 3),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000013', 0.5, 'lbs', 4),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000014', 4, 'oz', 5),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000010', 0.25, 'lbs', 6),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000011', 18, 'lbs', 7);

-- Recipe Ingredients: Sourdough Loaf
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('aa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', 50, 'lbs', 0),
  ('aa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000010', 1, 'lbs', 1);

-- Recipe Ingredients: Cinnamon Roll
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 10, 'lbs', 0),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000005', 5, 'lbs', 1),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000006', 4, 'lbs', 2),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000008', 0.5, 'lbs', 3),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', 2, 'gallons', 4),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000007', 0.25, 'lbs', 5),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000012', 2, 'dozen', 6);

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
INSERT INTO product_categories (id, org_id, name, description, sort_order) VALUES
  ('cc000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Bread', 'Loaves, rolls, and other bread products', 0),
  ('cc000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Pastry', 'Muffins, croissants, danishes, and pastries', 1),
  ('cc000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Cake', 'Cakes and cake-based products', 2),
  ('cc000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Cookie', 'Cookies and biscuits', 3),
  ('cc000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Frozen', 'Frozen finished products', 4);

-- ============================================================
-- PRODUCTS (hierarchy via product_components)
-- ============================================================

-- Base products (individual items from recipes)
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description, recipe_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Choc Chip Muffin Top (individual)', 'MT-CC-BASE', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'each',
   'Single unwrapped chocolate chip muffin top', 'aa000000-0000-0000-0000-000000000001'),

  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Sourdough Loaf', 'BRD-SD-001', 'bread', 'production', 'cc000000-0000-0000-0000-000000000001', 'loaves',
   'Classic sourdough bread loaf', 'aa000000-0000-0000-0000-000000000002'),

  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Cinnamon Roll (individual)', 'PST-CR-BASE', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'each',
   'Single cinnamon roll with cream cheese frosting', 'aa000000-0000-0000-0000-000000000003');

-- Blueberry Muffin Top base product
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description, recipe_id) VALUES
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Blueberry Muffin Top (individual)', 'MT-BB-BASE', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'each',
   'Single unwrapped blueberry muffin top', 'aa000000-0000-0000-0000-000000000004');

-- Lemon Poppyseed Muffin Top base product
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description, recipe_id) VALUES
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Lemon Poppyseed Muffin Top (individual)', 'MT-LP-BASE', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'each',
   'Single unwrapped lemon poppyseed muffin top', 'aa000000-0000-0000-0000-000000000005');

-- Variety 6-Pack (2 choc chip, 2 blueberry, 2 lemon poppyseed)
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description, upc, gtin) VALUES
  ('c0000000-0000-0000-0000-000000000050', 'a0000000-0000-0000-0000-000000000001',
   'Muffin Top Variety 6-Pack', 'MT-VAR-6PK', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'packs',
   '6-pack variety: 2 choc chip, 2 blueberry, 2 lemon poppyseed muffin tops',
   '012345678905', '00012345678905');

-- Variety 6-Pack Master Case (8 packs per case)
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description, gtin) VALUES
  ('c0000000-0000-0000-0000-000000000051', 'a0000000-0000-0000-0000-000000000001',
   'Variety 6-Pack Master Case (8ct)', 'MT-VAR-6PK-MC8', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'cases',
   'Master case containing 8x Muffin Top Variety 6-Packs',
   '10012345678902');

-- Branded variants (same muffin top, different wrappers)
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description) VALUES
  ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001',
   'Muffin Top - Brand A Wrapper', 'MT-CC-BRA', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'each',
   'Choc chip muffin top in Brand A retail wrapper'),

  ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001',
   'Muffin Top - Brand B Wrapper', 'MT-CC-BRB', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'each',
   'Choc chip muffin top in Brand B retail wrapper'),

  ('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001',
   'Muffin Top - Store Label Wrapper', 'MT-CC-STR', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'each',
   'Choc chip muffin top in generic store-label wrapper');

-- Pack sizes (Brand A)
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description, upc, gtin) VALUES
  ('c0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001',
   'Brand A Muffin Top 6-Pack', 'MT-CC-BRA-6PK', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'packs',
   '6-pack of Brand A wrapped muffin tops', '012345000061', '00012345000061'),

  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001',
   'Brand A Muffin Top 12-Pack', 'MT-CC-BRA-12PK', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'packs',
   '12-pack of Brand A wrapped muffin tops', '012345000122', '00012345000122');

-- Pack sizes (Brand B)
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description) VALUES
  ('c0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001',
   'Brand B Muffin Top 24-Pack', 'MT-CC-BRB-24PK', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'packs',
   '24-pack of Brand B wrapped muffin tops'),

  ('c0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000001',
   'Brand B Muffin Top 36-Pack', 'MT-CC-BRB-36PK', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'cases',
   '36-pack of Brand B wrapped muffin tops');

-- Master case
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description) VALUES
  ('c0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001',
   'Brand B 36-Pack Master Case (4ct)', 'MT-CC-BRB-36-MC4', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'cases',
   'Master case containing 4x Brand B 36-packs');

-- Cinnamon Roll packs
INSERT INTO products (id, org_id, name, sku, category, product_type, category_id, unit, description) VALUES
  ('c0000000-0000-0000-0000-000000000040', 'a0000000-0000-0000-0000-000000000001',
   'Cinnamon Roll 12-Pack', 'PST-CR-12PK', 'pastry', 'production', 'cc000000-0000-0000-0000-000000000002', 'packs',
   '12-pack of cinnamon rolls');

-- ============================================================
-- PRODUCT COMPONENTS (what goes inside each product)
-- ============================================================

-- Base muffin top contains 1 unit of the muffin top recipe output
INSERT INTO product_components (product_id, component_type, recipe_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'recipe', 'aa000000-0000-0000-0000-000000000001', 1, 'each');

-- Sourdough loaf contains 1 unit of sourdough recipe output
INSERT INTO product_components (product_id, component_type, recipe_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000002', 'recipe', 'aa000000-0000-0000-0000-000000000002', 1, 'loaves');

-- Cinnamon roll base contains 1 unit of cinnamon roll recipe output
INSERT INTO product_components (product_id, component_type, recipe_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000003', 'recipe', 'aa000000-0000-0000-0000-000000000003', 1, 'each');

-- Branded wrappers each contain 1 base muffin top
INSERT INTO product_components (product_id, component_type, component_product_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000010', 'product', 'c0000000-0000-0000-0000-000000000001', 1, 'each'),
  ('c0000000-0000-0000-0000-000000000011', 'product', 'c0000000-0000-0000-0000-000000000001', 1, 'each'),
  ('c0000000-0000-0000-0000-000000000012', 'product', 'c0000000-0000-0000-0000-000000000001', 1, 'each');

-- Brand A packs contain Brand A wrapped muffin tops
INSERT INTO product_components (product_id, component_type, component_product_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000020', 'product', 'c0000000-0000-0000-0000-000000000010', 6, 'each'),
  ('c0000000-0000-0000-0000-000000000021', 'product', 'c0000000-0000-0000-0000-000000000010', 12, 'each');

-- Brand B packs contain Brand B wrapped muffin tops
INSERT INTO product_components (product_id, component_type, component_product_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000022', 'product', 'c0000000-0000-0000-0000-000000000011', 24, 'each'),
  ('c0000000-0000-0000-0000-000000000023', 'product', 'c0000000-0000-0000-0000-000000000011', 36, 'each');

-- Master case contains 4x Brand B 36-packs
INSERT INTO product_components (product_id, component_type, component_product_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000030', 'product', 'c0000000-0000-0000-0000-000000000023', 4, 'cases');

-- Cinnamon roll 12-pack contains 12 individual cinnamon rolls
INSERT INTO product_components (product_id, component_type, component_product_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000040', 'product', 'c0000000-0000-0000-0000-000000000003', 12, 'each');

-- Blueberry base product contains 1 unit of blueberry recipe output
INSERT INTO product_components (product_id, component_type, recipe_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000004', 'recipe', 'aa000000-0000-0000-0000-000000000004', 1, 'each');

-- Lemon poppyseed base product contains 1 unit of lemon poppyseed recipe output
INSERT INTO product_components (product_id, component_type, recipe_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000005', 'recipe', 'aa000000-0000-0000-0000-000000000005', 1, 'each');

-- Variety 6-Pack: 2 choc chip + 2 blueberry + 2 lemon poppyseed
INSERT INTO product_components (product_id, component_type, component_product_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000050', 'product', 'c0000000-0000-0000-0000-000000000001', 2, 'each'),
  ('c0000000-0000-0000-0000-000000000050', 'product', 'c0000000-0000-0000-0000-000000000004', 2, 'each'),
  ('c0000000-0000-0000-0000-000000000050', 'product', 'c0000000-0000-0000-0000-000000000005', 2, 'each');

-- Variety 6-Pack Master Case: 8 variety packs
INSERT INTO product_components (product_id, component_type, component_product_id, quantity, unit) VALUES
  ('c0000000-0000-0000-0000-000000000051', 'product', 'c0000000-0000-0000-0000-000000000050', 8, 'packs');

-- ============================================================
-- RECIPE VERSIONS (versioned recipe data with approval workflow)
-- ============================================================

-- Chocolate Chip Muffin Top: v1 approved, v2 draft
INSERT INTO recipe_versions (id, recipe_id, version_number, status, yield_quantity, yield_unit, instructions, change_notes, created_at, approved_at) VALUES
  ('bb000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 1, 'approved',
   100, 'each',
   '1. Cream butter and sugar together until fluffy.
2. Add eggs one at a time, then vanilla.
3. Mix dry ingredients separately (flour, baking powder, salt).
4. Fold dry into wet, do not overmix.
5. Fold in chocolate chips.
6. Scoop onto sheet pans in muffin-top molds.
7. Bake at 375°F for 12-14 minutes until golden edges.',
   'Initial approved recipe', '2026-03-01', '2026-03-05'),

  ('bb000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000001', 2, 'draft',
   100, 'each',
   '1. Cream butter and sugar together until fluffy.
2. Add eggs one at a time, then vanilla.
3. Mix dry ingredients separately (flour, baking powder, salt).
4. Fold dry into wet, do not overmix.
5. Fold in chocolate chips.
6. Scoop onto sheet pans in muffin-top molds.
7. Bake at 375°F for 12-14 minutes until golden edges.
8. NEW: Cool on rack for 5 min before packaging.',
   'Added cooling step, increased chocolate chips to 20 lbs', '2026-04-10', NULL);

-- Sourdough Loaf: v1 approved
INSERT INTO recipe_versions (id, recipe_id, version_number, status, yield_quantity, yield_unit, instructions, change_notes, created_at, approved_at) VALUES
  ('bb000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000002', 1, 'approved',
   24, 'loaves',
   '1. Autolyse: mix flour and water, rest 1 hour.
2. Add starter and salt, stretch and fold every 30 min x 4.
3. Bulk ferment 8-12 hours at room temp.
4. Shape and place in banneton.
5. Cold retard 12-16 hours.
6. Score and bake at 450°F in dutch oven, 20 min covered + 20 min uncovered.',
   'Initial approved recipe', '2026-02-15', '2026-02-20');

-- Cinnamon Roll: v1 approved, v2 submitted for review
INSERT INTO recipe_versions (id, recipe_id, version_number, status, yield_quantity, yield_unit, instructions, change_notes, created_at, submitted_at, approved_at) VALUES
  ('bb000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000003', 1, 'approved',
   12, 'each',
   '1. Make enriched dough with flour, milk, butter, sugar, yeast, eggs.
2. Roll out dough, spread butter, cinnamon-sugar filling.
3. Roll tightly, cut into 12 pieces.
4. Proof until doubled.
5. Bake at 350°F for 22-25 minutes.
6. Top with cream cheese frosting while warm.',
   'Initial approved recipe', '2026-02-01', NULL, '2026-02-05'),

  ('bb000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000003', 2, 'submitted',
   12, 'each',
   '1. Make enriched dough with flour, milk, butter, sugar, yeast, eggs.
2. Roll out dough, spread butter, cinnamon-sugar filling.
3. Roll tightly, cut into 12 pieces.
4. Proof until doubled.
5. Bake at 340°F for 25-28 minutes (lower temp, longer time).
6. Top with cream cheese frosting while warm.',
   'Adjusted bake temp lower for softer texture', '2026-04-08', '2026-04-09', NULL);

-- Blueberry Muffin Top: v1 approved
INSERT INTO recipe_versions (id, recipe_id, version_number, status, yield_quantity, yield_unit, instructions, change_notes, created_at, approved_at) VALUES
  ('bb000000-0000-0000-0000-000000000006', 'aa000000-0000-0000-0000-000000000004', 1, 'approved',
   100, 'each',
   '1. Cream butter and sugar together until fluffy.
2. Add eggs one at a time, then vanilla.
3. Mix dry ingredients separately (flour, baking powder, salt).
4. Fold dry into wet, do not overmix.
5. Gently fold in frozen blueberries.
6. Scoop onto sheet pans in muffin-top molds.
7. Bake at 375°F for 14-16 minutes until golden.',
   'Initial approved recipe', '2026-03-10', '2026-03-12');

-- Lemon Poppyseed Muffin Top: v1 approved
INSERT INTO recipe_versions (id, recipe_id, version_number, status, yield_quantity, yield_unit, instructions, change_notes, created_at, approved_at) VALUES
  ('bb000000-0000-0000-0000-000000000007', 'aa000000-0000-0000-0000-000000000005', 1, 'approved',
   100, 'each',
   '1. Cream butter and sugar together until fluffy.
2. Add eggs one at a time, then vanilla and lemon juice.
3. Mix dry ingredients separately (flour, baking powder, salt, poppy seeds, lemon zest).
4. Fold dry into wet, do not overmix.
5. Scoop onto sheet pans in muffin-top molds.
6. Bake at 375°F for 12-14 minutes until golden edges.',
   'Initial approved recipe', '2026-03-10', '2026-03-12');

-- Set current_version_id on recipes
UPDATE recipes SET current_version_id = 'bb000000-0000-0000-0000-000000000001' WHERE id = 'aa000000-0000-0000-0000-000000000001';
UPDATE recipes SET current_version_id = 'bb000000-0000-0000-0000-000000000003' WHERE id = 'aa000000-0000-0000-0000-000000000002';
UPDATE recipes SET current_version_id = 'bb000000-0000-0000-0000-000000000004' WHERE id = 'aa000000-0000-0000-0000-000000000003';
UPDATE recipes SET current_version_id = 'bb000000-0000-0000-0000-000000000006' WHERE id = 'aa000000-0000-0000-0000-000000000004';
UPDATE recipes SET current_version_id = 'bb000000-0000-0000-0000-000000000007' WHERE id = 'aa000000-0000-0000-0000-000000000005';

-- Version ingredients for v1 of Chocolate Chip Muffin Top
INSERT INTO recipe_version_ingredients (recipe_version_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('bb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 25, 'lbs', 0),
  ('bb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000005', 12, 'lbs', 1),
  ('bb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000006', 15, 'lbs', 2),
  ('bb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000012', 5, 'dozen', 3),
  ('bb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000013', 0.5, 'lbs', 4),
  ('bb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000014', 4, 'oz', 5),
  ('bb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000010', 0.25, 'lbs', 6),
  ('bb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000011', 18, 'lbs', 7);

-- Version ingredients for v2 draft (more chocolate chips)
INSERT INTO recipe_version_ingredients (recipe_version_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('bb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 25, 'lbs', 0),
  ('bb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005', 12, 'lbs', 1),
  ('bb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000006', 15, 'lbs', 2),
  ('bb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000012', 5, 'dozen', 3),
  ('bb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000013', 0.5, 'lbs', 4),
  ('bb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000014', 4, 'oz', 5),
  ('bb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000010', 0.25, 'lbs', 6),
  ('bb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000011', 20, 'lbs', 7);

-- Version ingredients for Sourdough v1
INSERT INTO recipe_version_ingredients (recipe_version_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('bb000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 50, 'lbs', 0),
  ('bb000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000010', 1, 'lbs', 1);

-- Version ingredients for Cinnamon Roll v1
INSERT INTO recipe_version_ingredients (recipe_version_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('bb000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 10, 'lbs', 0),
  ('bb000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', 5, 'lbs', 1),
  ('bb000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000006', 4, 'lbs', 2),
  ('bb000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000008', 0.5, 'lbs', 3),
  ('bb000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', 2, 'gallons', 4),
  ('bb000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000007', 0.25, 'lbs', 5),
  ('bb000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000012', 2, 'dozen', 6);

-- Version ingredients for Blueberry Muffin Top v1
INSERT INTO recipe_version_ingredients (recipe_version_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('bb000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000001', 25, 'lbs', 0),
  ('bb000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000005', 12, 'lbs', 1),
  ('bb000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000006', 14, 'lbs', 2),
  ('bb000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000012', 5, 'dozen', 3),
  ('bb000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000013', 0.5, 'lbs', 4),
  ('bb000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000014', 4, 'oz', 5),
  ('bb000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000010', 0.25, 'lbs', 6),
  ('bb000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000015', 20, 'lbs', 7);

-- Version ingredients for Lemon Poppyseed Muffin Top v1
INSERT INTO recipe_version_ingredients (recipe_version_id, ingredient_id, quantity, unit, sort_order) VALUES
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 25, 'lbs', 0),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000005', 12, 'lbs', 1),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000006', 15, 'lbs', 2),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000012', 5, 'dozen', 3),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000013', 0.5, 'lbs', 4),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000014', 4, 'oz', 5),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000010', 0.25, 'lbs', 6),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000016', 2, 'lbs', 7),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000017', 1, 'lbs', 8),
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000018', 16, 'oz', 9);

-- ============================================================
-- RECIPE INGREDIENT SUBSTITUTIONS (per-recipe allow-list demo)
-- Sourdough Loaf: bread flour must come from Pacific NW (no
-- Mountain alt allowed). Empty allow-list for all other recipe
-- ingredients = any vendor SKU under that ingredient is fine.
-- ============================================================
INSERT INTO recipe_ingredient_substitutions (recipe_id, ingredient_id, raw_material_id) VALUES
  -- Sourdough Loaf: bread flour locked to PNW (no Mountain alt)
  ('aa000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000003'),
  -- Cinnamon Roll: butter accepts Cascade OR Olympic (NOT the PNW alt — different flavor profile)
  ('aa000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000005',
   'd0000000-0000-0000-0000-000000000005'),
  ('aa000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000005',
   'd0000000-0000-0000-0000-000000000022'),
  -- Cinnamon Roll: milk locked to Cascade (Olympic costs more)
  ('aa000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000004',
   'd0000000-0000-0000-0000-000000000004');

-- ============================================================
-- PRODUCTION LINES (workstations / benches / ovens)
-- ============================================================
INSERT INTO production_lines (id, org_id, name, description, is_active, sort_order) VALUES
  ('99000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Mixer 1', 'Large stand mixer; mornings primarily', true, 0),
  ('99000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Oven 2', 'Convection bank #2 — bread side', true, 1),
  ('99000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Assembly Bench', 'Finishing / packaging station', true, 2);

-- ============================================================
-- SCHEDULED BATCHES (for the calendar + satellite queue demo)
-- Dates intentionally spread over the next ~10 days from 2026-05-11.
-- ============================================================
INSERT INTO batches (
  id, org_id, batch_number, status, product_id, recipe_id, recipe_version_id,
  batch_type, quantity_produced, scheduled_date, scheduled_for,
  production_line_id, priority, estimated_duration_hours, assigned_to,
  notes, created_by
) VALUES
  ('88000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'BATCH-20260511-001', 'planned',
   'c0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001',
   'production', 100, '2026-05-11', '2026-05-11T07:00:00+00:00',
   '99000000-0000-0000-0000-000000000001', 'normal', 2, 'c0000000-0000-0000-0000-000000000001',
   'Chocolate chip muffin tops, weekday morning run', 'c0000000-0000-0000-0000-000000000001'),

  ('88000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'BATCH-20260511-002', 'planned',
   'c0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000003',
   'production', 24, '2026-05-11', '2026-05-11T09:30:00+00:00',
   '99000000-0000-0000-0000-000000000002', 'high', 4, 'c0000000-0000-0000-0000-000000000001',
   'Sourdough — Friday-eve pickup orders', 'c0000000-0000-0000-0000-000000000001'),

  ('88000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'BATCH-20260512-001', 'planned',
   'c0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000006',
   'production', 100, '2026-05-12', '2026-05-12T07:00:00+00:00',
   '99000000-0000-0000-0000-000000000001', 'normal', 2, NULL,
   NULL, 'c0000000-0000-0000-0000-000000000001'),

  ('88000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'BATCH-20260513-001', 'planned',
   'c0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000004',
   'production', 60, '2026-05-13', '2026-05-13T06:30:00+00:00',
   '99000000-0000-0000-0000-000000000003', 'normal', 3, NULL,
   'Cinnamon rolls for weekend wholesale', 'c0000000-0000-0000-0000-000000000001'),

  ('88000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'BATCH-20260514-001', 'planned',
   'c0000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000007',
   'production', 100, '2026-05-14', '2026-05-14T07:00:00+00:00',
   '99000000-0000-0000-0000-000000000001', 'low', 2, NULL,
   NULL, 'c0000000-0000-0000-0000-000000000001'),

  ('88000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'BATCH-20260518-001', 'planned',
   'c0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001',
   'production', 200, '2026-05-18', '2026-05-18T07:00:00+00:00',
   '99000000-0000-0000-0000-000000000001', 'urgent', 3, 'c0000000-0000-0000-0000-000000000001',
   'Double-batch — large catering order', 'c0000000-0000-0000-0000-000000000001');

-- Product allocations (each batch yields its primary product)
INSERT INTO batch_product_allocations (batch_id, product_id, quantity, unit) VALUES
  ('88000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 100, 'each'),
  ('88000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 24, 'loaves'),
  ('88000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 100, 'each'),
  ('88000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 60, 'each'),
  ('88000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', 100, 'each'),
  ('88000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 200, 'each');

-- ============================================================
-- DEV PROJECTS
-- ============================================================
INSERT INTO dev_projects (id, org_id, name, description, status, target_recipe_id) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Extra Chocolate Muffin Top R&D',
   'Testing increased chocolate chip ratio (18→20 lbs per 100 batch). Customer feedback says they want more chocolate.',
   'active', 'aa000000-0000-0000-0000-000000000001'),

  ('dd000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Gluten-Free Sourdough Exploration',
   'Early R&D into a gluten-free sourdough option using rice flour and psyllium husk.',
   'active', NULL);

-- ============================================================
-- BATCHES (production + development, linked to recipe versions)
-- ============================================================
INSERT INTO batches (id, org_id, recipe_id, recipe_version_id, product_id, batch_number, batch_type, status, quantity_produced, produced_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'BATCH-20260410-012', 'production', 'completed', 24, '2026-04-10'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', NULL, 'BATCH-20260410-011', 'production', 'in_progress', NULL, NULL),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', NULL, 'BATCH-20260409-010', 'production', 'completed', 100, '2026-04-09'),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000004', NULL, 'BATCH-20260409-009', 'production', 'completed', 48, '2026-04-09'),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'BATCH-20260408-008', 'production', 'on_hold', NULL, NULL);

-- Dev batches linked to the R&D project
INSERT INTO batches (id, org_id, recipe_id, recipe_version_id, batch_number, batch_type, status, quantity_produced, produced_at, dev_project_id) VALUES
  ('f0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000002', 'DEV-20260410-001', 'development', 'completed', 50, '2026-04-10', 'dd000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000002', 'DEV-20260411-002', 'development', 'in_progress', NULL, NULL, 'dd000000-0000-0000-0000-000000000001');

-- ============================================================
-- RBAC: Default Roles & Permissions
-- ============================================================

-- Create default roles for the org
INSERT INTO roles (id, org_id, name, description, is_system, is_admin) VALUES
  ('ee000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Administrator', 'Full access to all features and settings', true, true),
  ('ee000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Production Manager', 'Manage recipes, batches, and production scheduling', true, false),
  ('ee000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Line Operator', 'Record batch data, log compliance entries, view recipes', true, false),
  ('ee000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'QA Manager', 'Manage compliance, approve recipes, review HACCP plans', true, false),
  ('ee000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Sales / Orders', 'Manage orders and view products', true, false),
  ('ee000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'R&D Scientist', 'Run development projects and test batches', true, false);

-- Production Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000002', id FROM permissions
WHERE code IN (
  'recipes.view', 'recipes.create', 'recipes.edit', 'recipes.submit',
  'products.view', 'products.create', 'products.edit',
  'batches.view', 'batches.create', 'batches.edit',
  'materials.view', 'materials.create', 'materials.edit',
  'compliance.view', 'compliance.create',
  'inventory.view', 'inventory.manage',
  'orders.view',
  'development.view',
  'suppliers.view', 'suppliers.create', 'suppliers.edit'
);

-- Line Operator permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000003', id FROM permissions
WHERE code IN (
  'recipes.view',
  'products.view',
  'batches.view', 'batches.create', 'batches.edit',
  'materials.view',
  'compliance.view', 'compliance.create',
  'inventory.view'
);

-- QA Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000004', id FROM permissions
WHERE code IN (
  'recipes.view', 'recipes.approve',
  'products.view',
  'batches.view',
  'materials.view',
  'compliance.view', 'compliance.create', 'compliance.edit', 'compliance.manage',
  'inventory.view',
  'development.view'
);

-- Sales / Orders permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000005', id FROM permissions
WHERE code IN (
  'products.view',
  'orders.view', 'orders.create', 'orders.edit',
  'batches.view',
  'inventory.view'
);

-- R&D Scientist permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000006', id FROM permissions
WHERE code IN (
  'recipes.view', 'recipes.create', 'recipes.edit', 'recipes.submit',
  'products.view',
  'batches.view', 'batches.create', 'batches.edit',
  'materials.view',
  'development.view', 'development.create', 'development.edit',
  'compliance.view'
);

-- Sales role: customer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000005', id FROM permissions
WHERE code IN ('customers.view', 'customers.create', 'customers.edit');

-- Production Manager: view customers
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000002', id FROM permissions
WHERE code IN ('customers.view');

-- Assign seed admin user to Administrator role + grant all permissions
INSERT INTO user_roles (user_id, role_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT DO NOTHING;

-- Dev batch notes
INSERT INTO dev_batch_notes (batch_id, note_type, content, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000010', 'observation', 'Batter consistency looked slightly wetter with the extra 2 lbs of chocolate chips. May need to reduce milk by 0.5 gallon.', '2026-04-10 08:30:00'),
  ('f0000000-0000-0000-0000-000000000010', 'test_result', 'Taste test: 8/10 team consensus. Chocolate flavor noticeably better. Texture slightly softer than v1.', '2026-04-10 10:00:00'),
  ('f0000000-0000-0000-0000-000000000010', 'adjustment', 'Next batch: try reducing butter by 1 lb to compensate for added moisture from extra chips.', '2026-04-10 10:30:00'),
  ('f0000000-0000-0000-0000-000000000011', 'observation', 'Started second test batch with reduced butter. Monitoring oven temp closely.', '2026-04-11 07:00:00');

-- Batch Ingredients (traceability)
INSERT INTO batch_ingredients (batch_id, material_lot_id, quantity_used) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 50),
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 5),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 25),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000006', 18),
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 10),
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 5);

-- Customers
INSERT INTO customers (id, org_id, name, contact_name, email, phone, address, city, state, zip, notes, is_active) VALUES
  ('11000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Pike Place Market Cafe', 'Sarah Chen', 'orders@pikeplacecafe.com', '206-555-0101', '85 Pike St', 'Seattle', 'WA', '98101', 'Delivers Tuesday & Friday mornings. Use side entrance.', true),
  ('11000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Capitol Hill Bistro', 'Marcus Johnson', 'chef@capitolhillbistro.com', '206-555-0202', '1501 Broadway', 'Seattle', 'WA', '98122', 'Prefers invoice by email. Net-30 terms.', true),
  ('11000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Costco Regional', 'Linda Park', 'buyer@costco.com', '425-555-0303', '999 Lake Dr', 'Issaquah', 'WA', '98027', 'Master case pallets only. Requires COA per lot.', true),
  ('11000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Fremont Coffee Co', 'Dave Hollister', 'dave@fremontcoffee.com', '206-555-0404', '3601 Fremont Ave N', 'Seattle', 'WA', '98103', NULL, true),
  ('11000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Ballard Farmers Market', 'Amy Nguyen', 'vendor@ballardfm.org', '206-555-0505', NULL, 'Seattle', 'WA', NULL, 'Seasonal orders only — May through October.', false),
  ('11000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Green Lake Provisions', 'Rachel Kim', 'rachel@greenlakeprovisions.com', '206-555-0606', '7201 E Green Lake Dr N', 'Seattle', 'WA', '98115', NULL, true),
  ('11000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'University District Deli', 'Tom Brennan', 'tom@udeli.com', '206-555-0707', '4217 University Way NE', 'Seattle', 'WA', '98105', 'Closed Sundays. Buzz intercom at loading dock.', true),
  ('11000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Redmond Tech Café', 'Jessica Wu', 'jessica@redmondtechcafe.com', '425-555-0808', '16150 NE 85th St', 'Redmond', 'WA', '98052', 'Large standing order Mon & Thu. Confirm 48 hrs out.', true),
  ('11000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Bellevue Food Hall', 'Carlos Rivera', 'carlos@bellevuefoodhall.com', '425-555-0909', '575 Bellevue Square', 'Bellevue', 'WA', '98004', NULL, true),
  ('11000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Columbia City Kitchen', 'Maya Thompson', 'maya@columbiacitykitchen.com', '206-555-1010', '4866 Rainier Ave S', 'Seattle', 'WA', '98118', 'Prefers early morning drops before 7 AM.', true),
  ('11000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Queen Anne Grocer', 'Patrick O''Brien', 'patrick@queenannegrocery.com', '206-555-1111', '2100 Queen Anne Ave N', 'Seattle', 'WA', '98109', NULL, true),
  ('11000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'South Lake Union Pantry', 'Nina Patel', 'nina@slupantry.com', '206-555-1212', '333 Westlake Ave N', 'Seattle', 'WA', '98109', 'Refrigerated items only — no ambient storage on site.', true),
  ('11000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'Eastlake Provisions', 'Mark Sandoval', 'mark@eastlakeprovisions.com', '206-555-1313', '2301 Eastlake Ave E', 'Seattle', 'WA', '98102', NULL, true),
  ('11000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'Georgetown Alehouse', 'Steve Kowalski', 'steve@georgetownalehouse.com', '206-555-1414', '5804 Airport Way S', 'Seattle', 'WA', '98108', 'Net-15 terms. COD if overdue.', true),
  ('11000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'West Seattle Market', 'Diane Larson', 'diane@westseattlemarket.com', '206-555-1515', '4459 California Ave SW', 'Seattle', 'WA', '98116', NULL, true),
  ('11000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'Kirkland Waterfront Café', 'James Park', 'james@kirklandwf.com', '425-555-1616', '25 Lake Shore Plaza', 'Kirkland', 'WA', '98033', 'Seasonal patio menu — volume doubles May–Sep.', true),
  ('11000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001', 'Bellevue Food Co-op', 'Sharon Watts', 'sharon@bellevuecoop.com', '425-555-1717', '1400 140th Ave NE', 'Bellevue', 'WA', '98005', 'Organic certified products only.', true),
  ('11000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001', 'Edmonds Harbor Deli', 'Robert Ferris', 'rob@edmondsdeli.com', '425-555-1818', '110 Railroad Ave', 'Edmonds', 'WA', '98020', NULL, true),
  ('11000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001', 'Bothell Family Kitchen', 'Ann Summers', 'ann@bothellkitchen.com', '425-555-1919', '18315 Bothell Way NE', 'Bothell', 'WA', '98011', NULL, true),
  ('11000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001', 'Shoreline Fresh Market', 'Kevin Li', 'kevin@shorelinefresh.com', '206-555-2020', '15711 Westminster Way N', 'Shoreline', 'WA', '98133', 'High-volume account — verify quantities before loading.', true),
  ('11000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'Renton Urban Pantry', 'Priya Nair', 'priya@rentonpantry.com', '425-555-2121', '232 Williams Ave S', 'Renton', 'WA', '98057', NULL, true),
  ('11000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', 'Kent Valley Provisions', 'Larry Hoffman', 'larry@kentvalleyprovisions.com', '253-555-2222', '625 W Smith St', 'Kent', 'WA', '98032', 'Forklift available at dock — pallet orders preferred.', true),
  ('11000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000001', 'Auburn Specialty Foods', 'Maria Gonzalez', 'maria@auburnspecialty.com', '253-555-2323', '1 Auburn Way S', 'Auburn', 'WA', '98001', NULL, true),
  ('11000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000001', 'Tacoma Food Hub', 'Frank DeLuca', 'frank@tacomafoodhub.com', '253-555-2424', '1102 Broadway', 'Tacoma', 'WA', '98402', 'Check-in required at front desk before unloading.', true),
  ('11000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000001', 'Phinney Ridge Kitchen', 'Chloe Adams', 'chloe@phinneyridgekitchen.com', '206-555-2525', '6532 Phinney Ave N', 'Seattle', 'WA', '98103', NULL, true),
  ('11000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000001', 'Madison Valley Grocery', 'David Kim', 'david@madisonvalleygrocery.com', '206-555-2626', '2910 E Madison St', 'Seattle', 'WA', '98112', NULL, true),
  ('11000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000001', 'Madrona Café', 'Sarah Williams', 'sarah@madronacafe.com', '206-555-2727', '1138 34th Ave', 'Seattle', 'WA', '98122', 'Same building as Capitol Hill Bistro route — combine if possible.', true),
  ('11000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000001', 'Rainier Valley Foods', 'Emmanuel Osei', 'emmanuel@rainiervalleyfoods.com', '206-555-2828', '3601 Rainier Ave S', 'Seattle', 'WA', '98118', NULL, true),
  ('11000000-0000-0000-0000-000000000029', 'a0000000-0000-0000-0000-000000000001', 'Magnolia Market', 'Christine Lee', 'christine@magnoliamarket.com', '206-555-2929', '3214 W McGraw St', 'Seattle', 'WA', '98199', 'Narrow street — use cargo van only, no box trucks.', true),
  ('11000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', 'Northgate Commons Café', 'Ben Torres', 'ben@northgatecafe.com', '206-555-3030', '401 NE Northgate Way', 'Seattle', 'WA', '98125', NULL, true);

-- Delivery routes
INSERT INTO delivery_routes (id, org_id, name, description, day_of_week, driver_name, is_active) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Downtown Seattle', 'Core city stops: Pike/Cap Hill/Eastlake/Madrona', 'Mon, Wed, Fri', 'Carlos V.', true),
  ('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Eastside Loop', 'Bellevue, Kirkland, Redmond, Issaquah', 'Tue, Thu', 'Aisha R.', true),
  ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'North Seattle', 'Fremont up through Shoreline and Northgate', 'Wednesday', 'Mike T.', true),
  ('d1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'South Sound', 'Renton, Kent, Auburn, Tacoma', 'Friday', 'Diane L.', true);

-- Downtown Seattle stops
INSERT INTO delivery_route_stops (route_id, org_id, customer_id, stop_order, notes) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 1, 'Side entrance on Pike — ring bell'),
  ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000013', 2, NULL),
  ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 3, NULL),
  ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000027', 4, NULL),
  ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000026', 5, NULL),
  ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000012', 6, NULL);

-- Eastside Loop stops
INSERT INTO delivery_route_stops (route_id, org_id, customer_id, stop_order, notes) VALUES
  ('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000009', 1, NULL),
  ('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000017', 2, 'Organic cert required'),
  ('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000016', 3, NULL),
  ('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000008', 4, 'Call ahead 30 min'),
  ('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 5, 'Pallet only — have COA ready');

-- North Seattle stops
INSERT INTO delivery_route_stops (route_id, org_id, customer_id, stop_order, notes) VALUES
  ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000004', 1, NULL),
  ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000025', 2, NULL),
  ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000006', 3, NULL),
  ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000007', 4, 'Buzz intercom at dock'),
  ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000020', 5, 'Large order — verify quantities'),
  ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000030', 6, NULL);

-- South Sound stops
INSERT INTO delivery_route_stops (route_id, org_id, customer_id, stop_order, notes) VALUES
  ('d1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000021', 1, NULL),
  ('d1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000022', 2, 'Pallet orders preferred'),
  ('d1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000023', 3, NULL),
  ('d1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000024', 4, 'Check in at front desk');

-- Orders (linked to customers)
INSERT INTO orders (id, org_id, order_number, customer_name, customer_email, customer_id, status, ordered_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ORD-20260410-001', 'Pike Place Market Cafe', 'orders@pikeplacecafe.com', '11000000-0000-0000-0000-000000000001', 'confirmed', '2026-04-10'),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ORD-20260410-002', 'Capitol Hill Bistro', 'chef@capitolhillbistro.com', '11000000-0000-0000-0000-000000000002', 'pending', '2026-04-10'),
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'ORD-20260409-003', 'Costco Regional', 'buyer@costco.com', '11000000-0000-0000-0000-000000000003', 'processing', '2026-04-09');

-- Order Items (now referencing pack-level products)
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 24, 6.50),
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000040', 6, 18.00),
  ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000020', 10, 12.99),
  ('10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000030', 50, 89.99);

-- ============================================================
-- RECIPE VERSION SECTIONS (Cinnamon Roll v1: Dough + Filling)
-- ============================================================
INSERT INTO recipe_version_sections (id, recipe_version_id, name, sort_order, notes) VALUES
  ('cc000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000004', 'Dough', 0, 'Enriched yeasted dough base'),
  ('cc000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000004', 'Filling', 1, 'Cinnamon sugar filling spread on rolled dough');

-- Link Cinnamon Roll v1 ingredients to sections
-- Dough ingredients: flour, butter, sugar, yeast, milk, salt, eggs
UPDATE recipe_version_ingredients SET section_id = 'cc000000-0000-0000-0000-000000000001'
WHERE recipe_version_id = 'bb000000-0000-0000-0000-000000000004' AND sort_order IN (0, 1, 2, 3, 4, 5, 6);

-- Re-assign some as Filling: sugar and butter become filling
-- For demo, let's say sort_order 1 (butter) and 2 (sugar) are shared across,
-- and we'll reassign the last two (salt, eggs) to filling for illustration
UPDATE recipe_version_ingredients SET section_id = 'cc000000-0000-0000-0000-000000000002'
WHERE recipe_version_id = 'bb000000-0000-0000-0000-000000000004' AND sort_order IN (5, 6);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
INSERT INTO departments (id, org_id, name, description, color) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Production', 'Baking, mixing, and production floor operations', '#3B82F6'),
  ('dd000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Quality Assurance', 'Product quality, testing, and compliance', '#10B981'),
  ('dd000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Shipping & Fulfillment', 'Order packing, shipping, and logistics', '#8B5CF6'),
  ('dd000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Maintenance', 'Equipment maintenance and facility repairs', '#F59E0B'),
  ('dd000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'R&D', 'Recipe development and product innovation', '#EC4899');

-- Assign admin user to Production (as lead) and R&D
INSERT INTO user_departments (user_id, department_id, is_lead) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', true),
  ('c0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000005', false);

-- ============================================================
-- TASKS (sample data)
-- ============================================================
INSERT INTO tasks (id, org_id, title, description, status, priority, task_type, assigned_to, department_id, due_date, created_by) VALUES
  -- Production tasks
  ('ff000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Prep blueberry muffin top batch for Thursday',
   'Need 200 units for the weekend farmers market order. Check frozen blueberry inventory first.',
   'open', 'high', 'production',
   'c0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001',
   '2026-04-16', 'c0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Clean and sanitize mixer B',
   'Mixer B has residue buildup from yesterday''s chocolate batch. Full disassembly cleaning required.',
   'in_progress', 'medium', 'maintenance',
   'c0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000004',
   '2026-04-15', 'c0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Fix hole in break room wall',
   'Small hole near the door from the cart. Patch, sand, and repaint.',
   'open', 'low', 'maintenance',
   NULL, 'dd000000-0000-0000-0000-000000000004',
   '2026-04-25', 'c0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Monthly HACCP temperature log review',
   'Review all cold storage and oven temperature logs for April. Flag any out-of-range readings.',
   'open', 'high', 'quality',
   'c0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000002',
   '2026-04-30', 'c0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Order poppy seeds from Mountain Sugar Supply',
   'Running low on poppy seeds. Need at least 20 lbs for next week''s lemon poppyseed run.',
   'review', 'medium', 'admin',
   'c0000000-0000-0000-0000-000000000001', NULL,
   '2026-04-17', 'c0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'Ship variety 6-packs to Portland Grocery Co.',
   'Order #ORD-0001. 24 variety packs need to go out by Friday.',
   'open', 'urgent', 'general',
   NULL, 'dd000000-0000-0000-0000-000000000003',
   '2026-04-18', 'c0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'Develop gluten-free muffin top recipe',
   'R&D project: create a GF version of the chocolate chip muffin top using almond flour base.',
   'in_progress', 'medium', 'production',
   'c0000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000005',
   '2026-05-01', 'c0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'Update product labels with new GTIN codes',
   'New GTIN codes were assigned. Update label templates for all variety packs and master cases.',
   'done', 'medium', 'admin',
   'c0000000-0000-0000-0000-000000000001', NULL,
   '2026-04-14', 'c0000000-0000-0000-0000-000000000001');

-- Task comments
INSERT INTO task_comments (task_id, user_id, body, comment_type) VALUES
  ('ff000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'Started disassembly. Beater attachment has heavy buildup — soaking overnight.', 'comment'),
  ('ff000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001',
   'Sent PO to Lisa at Mountain Sugar. Waiting for confirmation.', 'comment'),
  ('ff000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001',
   'All labels updated and sent to printer.', 'comment');

-- Task permissions for existing roles
-- Production Manager: full task access
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000002', id FROM permissions
WHERE code IN ('tasks.view', 'tasks.create', 'tasks.edit', 'departments.view');

-- Line Operator: view and update own tasks
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000003', id FROM permissions
WHERE code IN ('tasks.view', 'tasks.edit');

-- QA Manager: full task access
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ee000000-0000-0000-0000-000000000004', id FROM permissions
WHERE code IN ('tasks.view', 'tasks.create', 'tasks.edit', 'departments.view');

-- Admin gets all (already handled by the catch-all below)

-- ============================================================
-- CHECKLIST TEMPLATES
-- ============================================================

-- Pre-Clean Checklist
INSERT INTO checklist_templates (id, org_id, name, description, is_active, created_by) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Pre-Clean Checklist', 'Standard pre-production cleaning checklist for all lines', true,
   'c0000000-0000-0000-0000-000000000001'),
  ('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'End of Shift Sanitation', 'Full sanitation protocol for end of production shift', true,
   'c0000000-0000-0000-0000-000000000001'),
  ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Mixer Setup Procedure', 'Step-by-step mixer setup and verification', true,
   'c0000000-0000-0000-0000-000000000001');

-- Versions
INSERT INTO checklist_template_versions (id, template_id, version_number, notes, is_published, created_by) VALUES
  -- Pre-Clean v1 (old, unpublished)
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 1,
   'Initial version', false, 'c0000000-0000-0000-0000-000000000001'),
  -- Pre-Clean v2 (current, published)
  ('d2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 2,
   'Added allergen wipe-down step', true, 'c0000000-0000-0000-0000-000000000001'),
  -- End of Shift v1 (published)
  ('d2000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 1,
   'Initial version', true, 'c0000000-0000-0000-0000-000000000001'),
  -- Mixer Setup v1 (published)
  ('d2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000003', 1,
   'Initial version', true, 'c0000000-0000-0000-0000-000000000001');

-- Pre-Clean v1 items (old version)
INSERT INTO checklist_template_items (version_id, label, description, sort_order, is_required) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'Clear work surfaces', 'Remove all product and debris from tables', 1, true),
  ('d2000000-0000-0000-0000-000000000001', 'Sweep floors', 'Sweep entire production area', 2, true),
  ('d2000000-0000-0000-0000-000000000001', 'Sanitize contact surfaces', 'Spray and wipe all food-contact surfaces', 3, true),
  ('d2000000-0000-0000-0000-000000000001', 'Check sanitizer concentration', 'Test strips must read 200ppm', 4, true),
  ('d2000000-0000-0000-0000-000000000001', 'Inspect for pests', 'Check traps and look for signs of pest activity', 5, false);

-- Pre-Clean v2 items (current version — uses answer types + conditions)
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options) VALUES
  ('d3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002',
   'Clear work surfaces', 'Remove all product and debris from tables', 1, true, 'yes_no', NULL),
  ('d3000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002',
   'Sweep floors', 'Sweep entire production area', 2, true, 'checkbox', NULL),
  ('d3000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000002',
   'Sanitize contact surfaces', 'Spray and wipe all food-contact surfaces', 3, true, 'yes_no', NULL),
  ('d3000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000002',
   'Allergen wipe-down', 'Full allergen clean on shared equipment per SOP-ALG-01', 4, true, 'select',
   '["Full clean","Partial clean","N/A - no allergens"]'),
  ('d3000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000002',
   'Check sanitizer concentration', 'Test strips must read 200ppm', 5, true, 'select',
   '["Pass (200ppm+)","Fail (below 200ppm)"]'),
  ('d3000000-0000-0000-0000-000000000006', 'd2000000-0000-0000-0000-000000000002',
   'Sanitizer corrective action', 'Describe what was done to fix the concentration', 6, true, 'text', NULL),
  ('d3000000-0000-0000-0000-000000000007', 'd2000000-0000-0000-0000-000000000002',
   'Inspect for pests', 'Check traps and look for signs of pest activity', 7, false, 'yes_no', NULL),
  ('d3000000-0000-0000-0000-000000000008', 'd2000000-0000-0000-0000-000000000002',
   'Describe pest findings', 'Note locations and type of pest activity observed', 8, true, 'text', NULL);

-- Conditions: "Sanitizer corrective action" only shows if concentration = Fail
UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000005',
    condition_operator = 'equals',
    condition_value = 'Fail (below 200ppm)'
WHERE id = 'd3000000-0000-0000-0000-000000000006';

-- Conditions: "Describe pest findings" only shows if pest inspection = Yes
UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000007',
    condition_operator = 'equals',
    condition_value = 'yes'
WHERE id = 'd3000000-0000-0000-0000-000000000008';

-- End of Shift v1 items (mixed answer types)
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options) VALUES
  ('d3000000-0000-0000-0000-000000000010', 'd2000000-0000-0000-0000-000000000003',
   'Stop all equipment', 'Power down mixers, ovens, conveyors', 1, true, 'checkbox', NULL),
  ('d3000000-0000-0000-0000-000000000011', 'd2000000-0000-0000-0000-000000000003',
   'Disassemble removable parts', 'Remove blades, guards, and chutes for cleaning', 2, true, 'checkbox', NULL),
  ('d3000000-0000-0000-0000-000000000012', 'd2000000-0000-0000-0000-000000000003',
   'Wash with hot water', 'All parts washed at 140F minimum', 3, true, 'true_false', NULL),
  ('d3000000-0000-0000-0000-000000000013', 'd2000000-0000-0000-0000-000000000003',
   'Apply sanitizer', 'Spray approved sanitizer on all surfaces', 4, true, 'select',
   '["Quaternary ammonia","Bleach solution","Peracetic acid"]'),
  ('d3000000-0000-0000-0000-000000000014', 'd2000000-0000-0000-0000-000000000003',
   'Reassemble equipment', 'Put all parts back in place', 5, true, 'checkbox', NULL),
  ('d3000000-0000-0000-0000-000000000015', 'd2000000-0000-0000-0000-000000000003',
   'Mop floors', 'Mop entire production floor with sanitizer solution', 6, true, 'checkbox', NULL),
  ('d3000000-0000-0000-0000-000000000016', 'd2000000-0000-0000-0000-000000000003',
   'Take out trash', 'All bins emptied and new liners placed', 7, true, 'yes_no', NULL),
  ('d3000000-0000-0000-0000-000000000017', 'd2000000-0000-0000-0000-000000000003',
   'Additional notes', 'Any issues or observations from this shift', 8, false, 'text', NULL),
  ('d3000000-0000-0000-0000-000000000018', 'd2000000-0000-0000-0000-000000000003',
   'Log completion', 'Sign off on sanitation log sheet', 9, true, 'checkbox', NULL);

-- Mixer Setup v1 items (with condition)
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options) VALUES
  ('d3000000-0000-0000-0000-000000000020', 'd2000000-0000-0000-0000-000000000004',
   'Inspect bowl for damage', 'Check for cracks, dents, or residue', 1, true, 'select',
   '["Pass","Fail - minor","Fail - critical"]'),
  ('d3000000-0000-0000-0000-000000000021', 'd2000000-0000-0000-0000-000000000004',
   'Describe bowl damage', 'Detail the damage found', 2, true, 'text', NULL),
  ('d3000000-0000-0000-0000-000000000022', 'd2000000-0000-0000-0000-000000000004',
   'Attach correct paddle', 'Verify paddle type matches recipe spec', 3, true, 'select',
   '["Flat beater","Dough hook","Wire whip","Paddle"]'),
  ('d3000000-0000-0000-0000-000000000023', 'd2000000-0000-0000-0000-000000000004',
   'Verify speed settings', 'Confirm mixer speed dial matches recipe instructions', 4, true, 'true_false', NULL),
  ('d3000000-0000-0000-0000-000000000024', 'd2000000-0000-0000-0000-000000000004',
   'Check safety guard', 'Ensure guard is in place and latched', 5, true, 'yes_no', NULL),
  ('d3000000-0000-0000-0000-000000000025', 'd2000000-0000-0000-0000-000000000004',
   'Test run (empty)', '10-second empty run to verify operation', 6, false, 'select',
   '["Pass","Fail - noise","Fail - vibration","Fail - other"]');

-- Condition: "Describe bowl damage" only if inspection != Pass
UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000020',
    condition_operator = 'not_equals',
    condition_value = 'Pass'
WHERE id = 'd3000000-0000-0000-0000-000000000021';

-- Add one sample task with a checklist (using answer types)
INSERT INTO task_checklist_items (id, task_id, label, description, sort_order, is_required, answer_type, answer_options, is_checked, answer_value, checked_by, checked_at, source_template_id, source_version_id, source_item_id) VALUES
  ('e3000000-0000-0000-0000-000000000001', 'ff000000-0000-0000-0000-000000000002',
   'Clear work surfaces', 'Remove all product and debris from tables', 1, true, 'yes_no', NULL,
   true, 'yes', 'c0000000-0000-0000-0000-000000000001', now() - interval '2 hours',
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000001'),
  ('e3000000-0000-0000-0000-000000000002', 'ff000000-0000-0000-0000-000000000002',
   'Sweep floors', 'Sweep entire production area', 2, true, 'checkbox', NULL,
   true, 'checked', 'c0000000-0000-0000-0000-000000000001', now() - interval '1 hour',
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000002'),
  ('e3000000-0000-0000-0000-000000000003', 'ff000000-0000-0000-0000-000000000002',
   'Sanitize contact surfaces', 'Spray and wipe all food-contact surfaces', 3, true, 'yes_no', NULL,
   false, NULL, NULL, NULL,
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000003'),
  ('e3000000-0000-0000-0000-000000000004', 'ff000000-0000-0000-0000-000000000002',
   'Allergen wipe-down', 'Full allergen clean on shared equipment per SOP-ALG-01', 4, true, 'select',
   '["Full clean","Partial clean","N/A - no allergens"]',
   false, NULL, NULL, NULL,
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000004'),
  ('e3000000-0000-0000-0000-000000000005', 'ff000000-0000-0000-0000-000000000002',
   'Check sanitizer concentration', 'Test strips must read 200ppm', 5, true, 'select',
   '["Pass (200ppm+)","Fail (below 200ppm)"]',
   false, NULL, NULL, NULL,
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000005'),
  ('e3000000-0000-0000-0000-000000000006', 'ff000000-0000-0000-0000-000000000002',
   'Sanitizer corrective action', 'Describe what was done to fix the concentration', 6, true, 'text', NULL,
   false, NULL, NULL, NULL,
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000006'),
  ('e3000000-0000-0000-0000-000000000007', 'ff000000-0000-0000-0000-000000000002',
   'Inspect for pests', 'Check traps and look for signs of pest activity', 7, false, 'yes_no', NULL,
   false, NULL, NULL, NULL,
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000007'),
  ('e3000000-0000-0000-0000-000000000008', 'ff000000-0000-0000-0000-000000000002',
   'Describe pest findings', 'Note locations and type of pest activity observed', 8, true, 'text', NULL,
   false, NULL, NULL, NULL,
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000008');

-- Set conditions on task checklist items (mirroring template conditions)
UPDATE task_checklist_items SET condition_item_id = 'e3000000-0000-0000-0000-000000000005',
  condition_operator = 'equals', condition_value = 'Fail (below 200ppm)'
WHERE id = 'e3000000-0000-0000-0000-000000000006';

UPDATE task_checklist_items SET condition_item_id = 'e3000000-0000-0000-0000-000000000007',
  condition_operator = 'equals', condition_value = 'yes'
WHERE id = 'e3000000-0000-0000-0000-000000000008';

-- Checklist permissions for existing roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM permissions p
CROSS JOIN (
  SELECT DISTINCT role_id FROM role_permissions
  WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'tasks.view')
) rp
WHERE p.code IN ('checklists.view', 'checklists.create', 'checklists.edit', 'checklists.delete')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ORG MODULES: Activate modules for Billy's Bakery
-- All core + development modules
-- ============================================================
INSERT INTO org_modules (org_id, module_id, is_active, activated_at, activated_by)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  m.id,
  true,
  now(),
  'c0000000-0000-0000-0000-000000000001'
FROM modules m
WHERE m.is_core = true
   OR m.slug IN ('development');

-- (Recipe → product links are set via products.recipe_id in the product INSERTs above)

-- ============================================================
-- CHECKLIST & TASK CATEGORIES
-- ============================================================
INSERT INTO checklist_categories (id, org_id, name, description, color, sort_order, is_active) VALUES
  ('ca000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Sanitation', 'Cleaning and sanitizing protocols', '#10B981', 1, true),
  ('ca000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Quality Control', 'QC inspections, audits, and testing', '#8B5CF6', 2, true),
  ('ca000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Equipment Setup', 'Machine setup and changeover checklists', '#3B82F6', 3, true),
  ('ca000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'Receiving & Storage', 'Ingredient intake and warehousing', '#F59E0B', 4, true),
  ('ca000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Safety & Compliance', 'Workplace safety and regulatory checks', '#EF4444', 5, true),
  ('ca000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'Production', 'Daily production line activities', '#EC4899', 6, true);

INSERT INTO task_categories (id, org_id, name, color, sort_order, is_active) VALUES
  ('cb000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Daily Operations', '#3B82F6', 1, true),
  ('cb000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Maintenance', '#F59E0B', 2, true),
  ('cb000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Customer Orders', '#10B981', 3, true),
  ('cb000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'R&D', '#8B5CF6', 4, true),
  ('cb000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Compliance & Audit', '#EF4444', 5, true);

-- Attach existing templates to categories
UPDATE checklist_templates SET category_id = 'ca000000-0000-0000-0000-000000000001' WHERE id = 'd1000000-0000-0000-0000-000000000001';
UPDATE checklist_templates SET category_id = 'ca000000-0000-0000-0000-000000000001' WHERE id = 'd1000000-0000-0000-0000-000000000002';
UPDATE checklist_templates SET category_id = 'ca000000-0000-0000-0000-000000000003' WHERE id = 'd1000000-0000-0000-0000-000000000003';

-- Attach existing tasks to categories
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000001' WHERE id = 'ff000000-0000-0000-0000-000000000001';
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000002' WHERE id = 'ff000000-0000-0000-0000-000000000002';
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000002' WHERE id = 'ff000000-0000-0000-0000-000000000003';
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000005' WHERE id = 'ff000000-0000-0000-0000-000000000004';
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000001' WHERE id = 'ff000000-0000-0000-0000-000000000005';
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000003' WHERE id = 'ff000000-0000-0000-0000-000000000006';
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000004' WHERE id = 'ff000000-0000-0000-0000-000000000007';
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000001' WHERE id = 'ff000000-0000-0000-0000-000000000008';

-- Mark the existing Pre-Clean v1 as archived (old version)
UPDATE checklist_template_versions
SET status = 'archived', archived_by = 'c0000000-0000-0000-0000-000000000001', archived_at = now() - interval '30 days'
WHERE id = 'd2000000-0000-0000-0000-000000000001';

-- Fill in approved_by/approved_at for existing approved versions
UPDATE checklist_template_versions
SET approved_by = 'c0000000-0000-0000-0000-000000000001', approved_at = now() - interval '15 days'
WHERE id IN (
  'd2000000-0000-0000-0000-000000000002',
  'd2000000-0000-0000-0000-000000000003',
  'd2000000-0000-0000-0000-000000000004'
);

-- ============================================================
-- ADDITIONAL CHECKLIST TEMPLATES (showcasing all answer types)
-- ============================================================

-- 4. HACCP Temperature Log — features temperature, datetime, number, employee_list, signature
INSERT INTO checklist_templates (id, org_id, name, description, category_id, is_active, created_by) VALUES
  ('d1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'HACCP Temperature Log', 'Daily cold-storage temperature monitoring per HACCP plan',
   'ca000000-0000-0000-0000-000000000002', true, 'c0000000-0000-0000-0000-000000000001'),

  ('d1000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'Incoming Ingredient Inspection', 'QA check on all incoming raw materials at receiving dock',
   'ca000000-0000-0000-0000-000000000004', true, 'c0000000-0000-0000-0000-000000000001'),

  ('d1000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'Shift Start Check-in', 'Operator sign-in with PPE verification and handoff notes',
   'ca000000-0000-0000-0000-000000000006', true, 'c0000000-0000-0000-0000-000000000001'),

  ('d1000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'Allergen Changeover Audit', 'Full allergen-changeover verification between product runs',
   'ca000000-0000-0000-0000-000000000002', true, 'c0000000-0000-0000-0000-000000000001'),

  ('d1000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'Fire Safety Monthly Walkthrough', 'Monthly inspection of fire extinguishers, alarms, and exits',
   'ca000000-0000-0000-0000-000000000005', true, 'c0000000-0000-0000-0000-000000000001'),

  ('d1000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001',
   'Oven Pre-Op Inspection', 'Pre-operation inspection for convection ovens',
   'ca000000-0000-0000-0000-000000000003', false, 'c0000000-0000-0000-0000-000000000001');

-- Versions for new templates (mix of statuses)
INSERT INTO checklist_template_versions (id, template_id, version_number, notes, is_published, status, created_by, approved_by, approved_at, submitted_for_review_by, submitted_for_review_at) VALUES
  -- HACCP Temperature Log v1 (approved)
  ('d2000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000004', 1,
   'Initial HACCP version aligned with 2026 FDA audit findings', true, 'approved',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', now() - interval '20 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '22 days'),
  -- HACCP Temperature Log v2 (draft — work in progress)
  ('d2000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000004', 2,
   'Adding freezer verification step after walk-in failure last week', false, 'draft',
   'c0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL),
  -- Incoming Ingredient Inspection v1 (approved)
  ('d2000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000005', 1,
   'First published version', true, 'approved',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', now() - interval '10 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '12 days'),
  -- Shift Start Check-in v1 (approved)
  ('d2000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000006', 1,
   'Initial version', true, 'approved',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', now() - interval '45 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '46 days'),
  -- Allergen Changeover Audit v1 (pending review)
  ('d2000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000007', 1,
   'First draft — needs review from QA manager', false, 'review',
   'c0000000-0000-0000-0000-000000000001', NULL, NULL,
   'c0000000-0000-0000-0000-000000000001', now() - interval '2 days'),
  -- Fire Safety Monthly Walkthrough v1 (approved)
  ('d2000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000008', 1,
   'Initial version', true, 'approved',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', now() - interval '60 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '61 days'),
  -- Oven Pre-Op v1 (draft, unused — this template is inactive)
  ('d2000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000009', 1,
   'Draft — template decommissioned before finalization', false, 'draft',
   'c0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL);

-- ── HACCP Temperature Log v1 items ─────────────────────────────
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options, config) VALUES
  ('d3000000-0000-0000-0000-000000000030', 'd2000000-0000-0000-0000-000000000005',
   'Log date and time', 'Automatically captured at time of entry', 1, true, 'datetime', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000031', 'd2000000-0000-0000-0000-000000000005',
   'Who is logging?', 'Operator performing the check', 2, true, 'employee_list', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000032', 'd2000000-0000-0000-0000-000000000005',
   'Walk-in fridge temperature', 'Safe range: 34–40°F', 3, true, 'temperature', NULL, '{"unit":"F","min":34,"max":40}'),
  ('d3000000-0000-0000-0000-000000000033', 'd2000000-0000-0000-0000-000000000005',
   'Walk-in freezer temperature', 'Safe range: -10 to 0°F', 4, true, 'temperature', NULL, '{"unit":"F","min":-10,"max":0}'),
  ('d3000000-0000-0000-0000-000000000034', 'd2000000-0000-0000-0000-000000000005',
   'Oven calibration check', 'Pull probe reading vs display', 5, true, 'number', NULL, '{"min":0,"max":500}'),
  ('d3000000-0000-0000-0000-000000000035', 'd2000000-0000-0000-0000-000000000005',
   'All readings within range?', 'If no, corrective action required below', 6, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000036', 'd2000000-0000-0000-0000-000000000005',
   'Corrective action taken', 'Describe the action taken when a reading was out of spec', 7, true, 'text', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000037', 'd2000000-0000-0000-0000-000000000005',
   'Supervisor notified?', 'Notify supervisor of out-of-range readings', 8, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000038', 'd2000000-0000-0000-0000-000000000005',
   'Operator signature', 'Sign to certify readings', 9, true, 'signature', NULL, NULL);

-- Condition: Corrective action only if readings NOT within range
UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000035', condition_operator = 'equals', condition_value = 'no'
WHERE id = 'd3000000-0000-0000-0000-000000000036';

-- Condition: Supervisor notified only if readings NOT within range
UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000035', condition_operator = 'equals', condition_value = 'no'
WHERE id = 'd3000000-0000-0000-0000-000000000037';

-- ── HACCP Temperature Log v2 items (draft; copies v1 + adds freezer check) ───
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options, config) VALUES
  ('d3000000-0000-0000-0000-000000000040', 'd2000000-0000-0000-0000-000000000006',
   'Log date and time', '', 1, true, 'datetime', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000041', 'd2000000-0000-0000-0000-000000000006',
   'Who is logging?', '', 2, true, 'employee_list', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000042', 'd2000000-0000-0000-0000-000000000006',
   'Walk-in fridge temperature', 'Safe range: 34–40°F', 3, true, 'temperature', NULL, '{"unit":"F","min":34,"max":40}'),
  ('d3000000-0000-0000-0000-000000000043', 'd2000000-0000-0000-0000-000000000006',
   'Walk-in freezer temperature', 'Safe range: -10 to 0°F', 4, true, 'temperature', NULL, '{"unit":"F","min":-10,"max":0}'),
  ('d3000000-0000-0000-0000-000000000044', 'd2000000-0000-0000-0000-000000000006',
   'Verify freezer door gasket seal', 'NEW: inspect gasket with flashlight for tears or ice', 5, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000045', 'd2000000-0000-0000-0000-000000000006',
   'Photo of gasket damage', 'Upload a photo of visible damage', 6, false, 'photo', NULL, NULL);

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000044', condition_operator = 'equals', condition_value = 'no'
WHERE id = 'd3000000-0000-0000-0000-000000000045';

-- ── Incoming Ingredient Inspection v1 items ────────────────────
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options, config) VALUES
  ('d3000000-0000-0000-0000-000000000050', 'd2000000-0000-0000-0000-000000000007',
   'Supplier name', 'Who delivered the shipment?', 1, true, 'select', '["Pacific NW Flour Co.","Cascade Dairy","Mountain Sugar Supply","Choco Source Inc.","Other"]', NULL),
  ('d3000000-0000-0000-0000-000000000051', 'd2000000-0000-0000-0000-000000000007',
   'Scan vendor barcode', 'Use handheld scanner on packaging', 2, true, 'barcode_scan', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000052', 'd2000000-0000-0000-0000-000000000007',
   'Number of pallets received', '', 3, true, 'number', NULL, '{"min":1,"max":50}'),
  ('d3000000-0000-0000-0000-000000000053', 'd2000000-0000-0000-0000-000000000007',
   'Packaging condition', 'Check for damage, tears, or contamination', 4, true, 'radio', '["Excellent","Good","Minor damage","Major damage - REJECT"]', NULL),
  ('d3000000-0000-0000-0000-000000000054', 'd2000000-0000-0000-0000-000000000007',
   'Photo of packaging damage', 'Document with photo', 5, true, 'photo', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000055', 'd2000000-0000-0000-0000-000000000007',
   'Truck temperature at unload', '', 6, true, 'temperature', NULL, '{"unit":"F"}'),
  ('d3000000-0000-0000-0000-000000000056', 'd2000000-0000-0000-0000-000000000007',
   'Allergens declared on BOL', 'Mark all allergens indicated on the bill of lading', 7, true, 'multi_select',
   '["Wheat","Dairy","Eggs","Soy","Peanuts","Tree nuts","Sesame","Fish","Shellfish","None"]', NULL),
  ('d3000000-0000-0000-0000-000000000057', 'd2000000-0000-0000-0000-000000000007',
   'Lot number matches COA', 'Enter the lot number from the COA, it must match the packaging', 8, true, 'text_match', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000058', 'd2000000-0000-0000-0000-000000000007',
   'Receiving inspector', '', 9, true, 'employee_list', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000059', 'd2000000-0000-0000-0000-000000000007',
   'Inspector signature', 'Sign off on receiving inspection', 10, true, 'signature', NULL, NULL);

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000053', condition_operator = 'contains', condition_value = 'damage'
WHERE id = 'd3000000-0000-0000-0000-000000000054';

-- ── Shift Start Check-in v1 items ──────────────────────────────
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options, config) VALUES
  ('d3000000-0000-0000-0000-000000000060', 'd2000000-0000-0000-0000-000000000008',
   'Check-in time', '', 1, true, 'datetime', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000061', 'd2000000-0000-0000-0000-000000000008',
   'Operator on duty', '', 2, true, 'employee_list', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000062', 'd2000000-0000-0000-0000-000000000008',
   'Wearing required PPE?', 'Hair net, gloves, apron, closed-toe shoes', 3, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000063', 'd2000000-0000-0000-0000-000000000008',
   'Which PPE is missing?', '', 4, true, 'multi_select', '["Hair net","Gloves","Apron","Closed-toe shoes","Face mask"]', NULL),
  ('d3000000-0000-0000-0000-000000000064', 'd2000000-0000-0000-0000-000000000008',
   'Feeling well (no fever, cough, open wounds)?', 'Self-attestation of health per company policy', 5, true, 'true_false', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000065', 'd2000000-0000-0000-0000-000000000008',
   'Notes from previous shift', 'Anything from the handoff board that needs attention', 6, false, 'text', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000066', 'd2000000-0000-0000-0000-000000000008',
   'Ready to start production', 'Sign to confirm you are fit for duty', 7, true, 'signature', NULL, NULL);

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000062', condition_operator = 'equals', condition_value = 'no'
WHERE id = 'd3000000-0000-0000-0000-000000000063';

-- ── Allergen Changeover Audit v1 items (pending review) ────────
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options, config) VALUES
  ('d3000000-0000-0000-0000-000000000070', 'd2000000-0000-0000-0000-000000000009',
   'Previous product allergens', 'Which allergens were present in the previous run?', 1, true, 'multi_select',
   '["Wheat","Dairy","Eggs","Soy","Peanuts","Tree nuts","Sesame"]', NULL),
  ('d3000000-0000-0000-0000-000000000071', 'd2000000-0000-0000-0000-000000000009',
   'Incoming product allergens', 'Which allergens are in the next run?', 2, true, 'multi_select',
   '["Wheat","Dairy","Eggs","Soy","Peanuts","Tree nuts","Sesame"]', NULL),
  ('d3000000-0000-0000-0000-000000000072', 'd2000000-0000-0000-0000-000000000009',
   'Disassemble mixer bowl', '', 3, true, 'checkbox', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000073', 'd2000000-0000-0000-0000-000000000009',
   'Pre-wash with hot water', 'Minimum 140°F', 4, true, 'true_false', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000074', 'd2000000-0000-0000-0000-000000000009',
   'Allergen-specific detergent used', '', 5, true, 'select',
   '["PuroClean AL","Sani-Pure Allergen Wash","Other (specify in notes)"]', NULL),
  ('d3000000-0000-0000-0000-000000000075', 'd2000000-0000-0000-0000-000000000009',
   'ATP swab result (RLU)', 'Must read ≤10 RLU to pass', 6, true, 'number', NULL, '{"min":0,"max":500}'),
  ('d3000000-0000-0000-0000-000000000076', 'd2000000-0000-0000-0000-000000000009',
   'ATP pass threshold met?', '', 7, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000077', 'd2000000-0000-0000-0000-000000000009',
   'Re-clean required', 'If ATP failed, repeat cleaning steps', 8, true, 'checkbox', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000078', 'd2000000-0000-0000-0000-000000000009',
   'QA sign-off', 'QA manager signature required', 9, true, 'signature', NULL, NULL);

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000075', condition_operator = 'gt', condition_value = '10'
WHERE id = 'd3000000-0000-0000-0000-000000000077';

-- ── Fire Safety Monthly Walkthrough v1 items ───────────────────
INSERT INTO checklist_template_items (id, version_id, label, description, sort_order, is_required, answer_type, answer_options, config) VALUES
  ('d3000000-0000-0000-0000-000000000080', 'd2000000-0000-0000-0000-000000000010',
   'Inspection date', '', 1, true, 'datetime', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000081', 'd2000000-0000-0000-0000-000000000010',
   'Inspector name', '', 2, true, 'employee_list', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000082', 'd2000000-0000-0000-0000-000000000010',
   'All fire extinguishers in place', 'Verify each mounted extinguisher is in its bracket', 3, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000083', 'd2000000-0000-0000-0000-000000000010',
   'All extinguishers charged (green zone on gauge)', '', 4, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000084', 'd2000000-0000-0000-0000-000000000010',
   'Inspection tags current', 'Annual inspection tag within 12 months', 5, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000085', 'd2000000-0000-0000-0000-000000000010',
   'Emergency exits clear', 'No obstructions within 36 inches of exits', 6, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000086', 'd2000000-0000-0000-0000-000000000010',
   'Exit signs illuminated', '', 7, true, 'yes_no', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000087', 'd2000000-0000-0000-0000-000000000010',
   'Fire alarm test button pressed', 'Perform a monthly function test per NFPA 72', 8, true, 'checkbox', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000088', 'd2000000-0000-0000-0000-000000000010',
   'Hood suppression system tag date', 'Enter last inspection date', 9, true, 'datetime', NULL, NULL),
  ('d3000000-0000-0000-0000-000000000089', 'd2000000-0000-0000-0000-000000000010',
   'Issues found', 'Detail any deficiencies', 10, false, 'text', NULL, NULL);

-- ============================================================
-- CHECKLIST RUNS (standalone executions)
-- ============================================================
INSERT INTO checklist_runs (id, org_id, checklist_id, version_id, started_by, completed_by, status, notes, started_at, completed_at, approved_by, approved_at) VALUES
  -- HACCP Temp Log — approved run (yesterday)
  ('d4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', 'Walk-in freezer flagged — maintenance ticket created',
   now() - interval '1 day' - interval '6 hours',
   now() - interval '1 day' - interval '5 hours 45 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '1 day' - interval '3 hours'),

  -- HACCP Temp Log — completed, pending approval (earlier today)
  ('d4000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'completed', 'All readings nominal',
   now() - interval '4 hours', now() - interval '3 hours 50 minutes',
   NULL, NULL),

  -- Pre-Clean Checklist — approved run
  ('d4000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', 'Standard pre-production clean — Line 1',
   now() - interval '2 days' - interval '8 hours',
   now() - interval '2 days' - interval '7 hours 30 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '2 days' - interval '5 hours'),

  -- Incoming Ingredient Inspection — approved
  ('d4000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000007',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', '40 lbs of bread flour from PNW — minor outer packaging damage',
   now() - interval '3 days' - interval '9 hours',
   now() - interval '3 days' - interval '8 hours 50 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '3 days' - interval '4 hours'),

  -- Incoming Ingredient Inspection — in progress
  ('d4000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000007',
   'c0000000-0000-0000-0000-000000000001', NULL,
   'in_progress', NULL,
   now() - interval '30 minutes', NULL, NULL, NULL),

  -- Shift Start — approved (morning run)
  ('d4000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000006', 'd2000000-0000-0000-0000-000000000008',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', 'AM shift',
   now() - interval '1 day' - interval '10 hours',
   now() - interval '1 day' - interval '9 hours 55 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '1 day' - interval '9 hours'),

  -- Fire Safety — approved (last month)
  ('d4000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000008', 'd2000000-0000-0000-0000-000000000010',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', 'Monthly walkthrough — all clear',
   now() - interval '28 days', now() - interval '28 days' + interval '25 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '27 days'),

  -- End of Shift Sanitation — completed pending approval
  ('d4000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'completed', 'End of PM shift',
   now() - interval '1 day' - interval '18 hours',
   now() - interval '1 day' - interval '17 hours 40 minutes',
   NULL, NULL);

-- ============================================================
-- CHECKLIST RUN ANSWERS
-- ============================================================
-- Answers for d4...001 (HACCP — approved with freezer fail)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000030', 'datetime', '2026-04-14T06:02:00-07:00', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000031', 'employee_list', 'c0000000-0000-0000-0000-000000000001', '{"selected":["c0000000-0000-0000-0000-000000000001"]}', NULL),
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000032', 'temperature', '38', NULL, '{"unit":"F"}'),
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000033', 'temperature', '8', NULL, '{"unit":"F"}'),
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000034', 'number', '355', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000035', 'yes_no', 'no', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000036', 'text', 'Walk-in freezer read 8°F (above -10–0 range). Adjusted thermostat and opened maintenance ticket MX-2038.', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000037', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000038', 'signature', 'Billy Rainford', '{"name":"Billy Rainford","signed_at":"2026-04-14T06:14:00-07:00"}', NULL);

-- Answers for d4...002 (HACCP — completed nominal)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config) VALUES
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000030', 'datetime', now()::text, NULL, NULL),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000031', 'employee_list', 'c0000000-0000-0000-0000-000000000001', '{"selected":["c0000000-0000-0000-0000-000000000001"]}', NULL),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000032', 'temperature', '37', NULL, '{"unit":"F"}'),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000033', 'temperature', '-4', NULL, '{"unit":"F"}'),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000034', 'number', '350', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000035', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000038', 'signature', 'Billy Rainford', '{"name":"Billy Rainford"}', NULL);

-- Answers for d4...003 (Pre-Clean approved)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config) VALUES
  ('d4000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000001', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000002', 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000003', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000004', 'select', 'Full clean', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000005', 'select', 'Pass (200ppm+)', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000007', 'yes_no', 'no', NULL, NULL);

-- Answers for d4...004 (Incoming Ingredient approved with minor damage)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config) VALUES
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000050', 'select', 'Pacific NW Flour Co.', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000051', 'barcode_scan', 'PNW-AP-50LB-2026041104', '{"scanned_at":"2026-04-12T09:15:00-07:00"}', NULL),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000052', 'number', '4', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000053', 'radio', 'Minor damage', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000054', 'photo', '/uploads/receiving/2026-04-12-pnw-damage.jpg', '{"uploaded_at":"2026-04-12T09:18:00-07:00"}', NULL),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000055', 'temperature', '62', NULL, '{"unit":"F"}'),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000056', 'multi_select', 'Wheat', '{"selected":["Wheat"]}', NULL),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000057', 'text_match', 'LOT-PNW-26041104-AP', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000058', 'employee_list', 'c0000000-0000-0000-0000-000000000001', '{"selected":["c0000000-0000-0000-0000-000000000001"]}', NULL),
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000059', 'signature', 'Billy Rainford', '{"name":"Billy Rainford"}', NULL);

-- Answers for d4...005 (in progress — partial)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config) VALUES
  ('d4000000-0000-0000-0000-000000000005', 'd3000000-0000-0000-0000-000000000050', 'select', 'Cascade Dairy', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000005', 'd3000000-0000-0000-0000-000000000051', 'barcode_scan', 'CD-WB-5G-202604150', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000005', 'd3000000-0000-0000-0000-000000000052', 'number', '2', NULL, NULL);

-- Answers for d4...006 (Shift Start approved)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config) VALUES
  ('d4000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000060', 'datetime', '2026-04-14T05:58:00-07:00', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000061', 'employee_list', 'c0000000-0000-0000-0000-000000000001', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000062', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000064', 'true_false', 'true', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000065', 'text', 'Mixer B still out for service — use Mixer A only today.', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000066', 'signature', 'Billy Rainford', NULL, NULL);

-- Answers for d4...007 (Fire Safety approved)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config) VALUES
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000080', 'datetime', '2026-03-18T10:00:00-07:00', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000081', 'employee_list', 'c0000000-0000-0000-0000-000000000001', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000082', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000083', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000084', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000085', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000086', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000087', 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000088', 'datetime', '2026-01-15T09:00:00-08:00', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000089', 'text', 'No deficiencies found.', NULL, NULL);

-- Answers for d4...008 (End of Shift Sanitation — pending approval)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config) VALUES
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000010', 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000011', 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000012', 'true_false', 'true', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000013', 'select', 'Quaternary ammonia', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000014', 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000015', 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000016', 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000017', 'text', 'Noticed a slow drain near Sink 2 — flagged to maintenance.', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000018', 'checkbox', 'checked', NULL, NULL);

-- ============================================================
-- TASK COMPLETIONS
-- ============================================================
INSERT INTO task_completions (id, task_id, completed_by, notes, period_start, period_end, status, completed_at, approved_by, approved_at, checklist_run_id) VALUES
  -- Approved completion for the shipped order task
  ('d6000000-0000-0000-0000-000000000001', 'ff000000-0000-0000-0000-000000000008',
   'c0000000-0000-0000-0000-000000000001',
   'Labels printed and applied to 24 variety packs. Verified GTIN barcodes scan correctly.',
   NULL, NULL, 'approved', now() - interval '1 day' - interval '2 hours',
   'c0000000-0000-0000-0000-000000000001', now() - interval '1 day' - interval '1 hour', NULL),

  -- Pending completion on mixer cleaning task (linked to pre-clean run)
  ('d6000000-0000-0000-0000-000000000002', 'ff000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001',
   'Mixer B disassembled, cleaned, and reassembled. Beater showing wear — flagged for replacement.',
   NULL, NULL, 'pending', now() - interval '2 hours', NULL, NULL,
   'd4000000-0000-0000-0000-000000000003'),

  -- Rejected completion (review task sent back)
  ('d6000000-0000-0000-0000-000000000003', 'ff000000-0000-0000-0000-000000000004',
   'c0000000-0000-0000-0000-000000000001',
   'Reviewed temperature logs for April 1–12.',
   '2026-04-01', '2026-04-12',
   'rejected', now() - interval '3 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '2 days 12 hours', NULL),

  -- Another pending completion
  ('d6000000-0000-0000-0000-000000000004', 'ff000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000001',
   'PO #PO-2026-0412 submitted to Mountain Sugar for 25 lbs poppy seeds.',
   NULL, NULL, 'pending', now() - interval '6 hours', NULL, NULL, NULL);

-- Grant new permissions to existing roles (new migration added them; seed roles predate it)
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM permissions p
CROSS JOIN (
  SELECT DISTINCT role_id FROM role_permissions
  WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'tasks.view')
) rp
WHERE p.code IN ('checklists.run', 'checklists.approve', 'tasks.approve')
ON CONFLICT DO NOTHING;
