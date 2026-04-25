-- ═══════════════════════════════════════════════════════════════════
-- Expanded Checklist & Task Sample Data
-- ═══════════════════════════════════════════════════════════════════
-- This is an apply-only script that adds sample data on top of your
-- existing database WITHOUT wiping it. All inserts are idempotent
-- (use ON CONFLICT DO NOTHING) or guarded with fixed UUIDs.
--
-- Run from inside the Proviant folder with:
--   psql "$(supabase status | grep 'DB URL' | awk '{print $3}')" \
--        -f supabase/snippets/expand_checklist_seed_data.sql
--
-- Or paste it into the Supabase SQL editor / Studio.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Categories ──────────────────────────────────────────────────
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
   'Production', 'Daily production line activities', '#EC4899', 6, true)
ON CONFLICT (id) DO NOTHING;

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
   'Compliance & Audit', '#EF4444', 5, true)
ON CONFLICT (id) DO NOTHING;

-- Attach existing templates/tasks to categories (safe to re-run)
UPDATE checklist_templates SET category_id = 'ca000000-0000-0000-0000-000000000001' WHERE id = 'd1000000-0000-0000-0000-000000000001' AND category_id IS NULL;
UPDATE checklist_templates SET category_id = 'ca000000-0000-0000-0000-000000000001' WHERE id = 'd1000000-0000-0000-0000-000000000002' AND category_id IS NULL;
UPDATE checklist_templates SET category_id = 'ca000000-0000-0000-0000-000000000003' WHERE id = 'd1000000-0000-0000-0000-000000000003' AND category_id IS NULL;

UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000001' WHERE id = 'ff000000-0000-0000-0000-000000000001' AND category_id IS NULL;
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000002' WHERE id = 'ff000000-0000-0000-0000-000000000002' AND category_id IS NULL;
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000002' WHERE id = 'ff000000-0000-0000-0000-000000000003' AND category_id IS NULL;
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000005' WHERE id = 'ff000000-0000-0000-0000-000000000004' AND category_id IS NULL;
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000001' WHERE id = 'ff000000-0000-0000-0000-000000000005' AND category_id IS NULL;
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000003' WHERE id = 'ff000000-0000-0000-0000-000000000006' AND category_id IS NULL;
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000004' WHERE id = 'ff000000-0000-0000-0000-000000000007' AND category_id IS NULL;
UPDATE tasks SET category_id = 'cb000000-0000-0000-0000-000000000001' WHERE id = 'ff000000-0000-0000-0000-000000000008' AND category_id IS NULL;

-- Archive Pre-Clean v1, fill audit trail on approved versions (only if not already set)
UPDATE checklist_template_versions
SET status = 'archived', archived_by = 'c0000000-0000-0000-0000-000000000001', archived_at = COALESCE(archived_at, now() - interval '30 days')
WHERE id = 'd2000000-0000-0000-0000-000000000001' AND status = 'draft';

UPDATE checklist_template_versions
SET approved_by = 'c0000000-0000-0000-0000-000000000001', approved_at = COALESCE(approved_at, now() - interval '15 days')
WHERE id IN (
  'd2000000-0000-0000-0000-000000000002',
  'd2000000-0000-0000-0000-000000000003',
  'd2000000-0000-0000-0000-000000000004'
) AND approved_by IS NULL;

-- ── Additional Templates ────────────────────────────────────────
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
   'ca000000-0000-0000-0000-000000000003', false, 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ── Additional Versions ─────────────────────────────────────────
INSERT INTO checklist_template_versions (id, template_id, version_number, notes, is_published, status, created_by, approved_by, approved_at, submitted_for_review_by, submitted_for_review_at) VALUES
  ('d2000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000004', 1,
   'Initial HACCP version aligned with 2026 FDA audit findings', true, 'approved',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', now() - interval '20 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '22 days'),
  ('d2000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000004', 2,
   'Adding freezer verification step after walk-in failure last week', false, 'draft',
   'c0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL),
  ('d2000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000005', 1,
   'First published version', true, 'approved',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', now() - interval '10 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '12 days'),
  ('d2000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000006', 1,
   'Initial version', true, 'approved',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', now() - interval '45 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '46 days'),
  ('d2000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000007', 1,
   'First draft — needs review from QA manager', false, 'review',
   'c0000000-0000-0000-0000-000000000001', NULL, NULL,
   'c0000000-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('d2000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000008', 1,
   'Initial version', true, 'approved',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', now() - interval '60 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '61 days'),
  ('d2000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000009', 1,
   'Draft — template decommissioned before finalization', false, 'draft',
   'c0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── HACCP v1 items ──────────────────────────────────────────────
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
   'Operator signature', 'Sign to certify readings', 9, true, 'signature', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000035', condition_operator = 'equals', condition_value = 'no'
WHERE id = 'd3000000-0000-0000-0000-000000000036' AND condition_item_id IS NULL;
UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000035', condition_operator = 'equals', condition_value = 'no'
WHERE id = 'd3000000-0000-0000-0000-000000000037' AND condition_item_id IS NULL;

-- ── HACCP v2 items (draft) ──────────────────────────────────────
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
   'Photo of gasket damage', 'Upload a photo of visible damage', 6, false, 'photo', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000044', condition_operator = 'equals', condition_value = 'no'
WHERE id = 'd3000000-0000-0000-0000-000000000045' AND condition_item_id IS NULL;

-- ── Incoming Ingredient Inspection v1 items ─────────────────────
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
   'Inspector signature', 'Sign off on receiving inspection', 10, true, 'signature', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000053', condition_operator = 'contains', condition_value = 'damage'
WHERE id = 'd3000000-0000-0000-0000-000000000054' AND condition_item_id IS NULL;

-- ── Shift Start Check-in v1 items ───────────────────────────────
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
   'Ready to start production', 'Sign to confirm you are fit for duty', 7, true, 'signature', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000062', condition_operator = 'equals', condition_value = 'no'
WHERE id = 'd3000000-0000-0000-0000-000000000063' AND condition_item_id IS NULL;

-- ── Allergen Changeover Audit v1 items ──────────────────────────
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
   'QA sign-off', 'QA manager signature required', 9, true, 'signature', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE checklist_template_items
SET condition_item_id = 'd3000000-0000-0000-0000-000000000075', condition_operator = 'gt', condition_value = '10'
WHERE id = 'd3000000-0000-0000-0000-000000000077' AND condition_item_id IS NULL;

-- ── Fire Safety Monthly Walkthrough v1 items ────────────────────
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
   'Issues found', 'Detail any deficiencies', 10, false, 'text', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Checklist Runs ──────────────────────────────────────────────
INSERT INTO checklist_runs (id, org_id, checklist_id, version_id, started_by, completed_by, status, notes, started_at, completed_at, approved_by, approved_at) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', 'Walk-in freezer flagged — maintenance ticket created',
   now() - interval '1 day' - interval '6 hours',
   now() - interval '1 day' - interval '5 hours 45 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '1 day' - interval '3 hours'),
  ('d4000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'completed', 'All readings nominal',
   now() - interval '4 hours', now() - interval '3 hours 50 minutes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', 'Standard pre-production clean — Line 1',
   now() - interval '2 days' - interval '8 hours',
   now() - interval '2 days' - interval '7 hours 30 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '2 days' - interval '5 hours'),
  ('d4000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000007',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', '40 lbs of bread flour from PNW — minor outer packaging damage',
   now() - interval '3 days' - interval '9 hours',
   now() - interval '3 days' - interval '8 hours 50 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '3 days' - interval '4 hours'),
  ('d4000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000007',
   'c0000000-0000-0000-0000-000000000001', NULL,
   'in_progress', NULL,
   now() - interval '30 minutes', NULL, NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000006', 'd2000000-0000-0000-0000-000000000008',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', 'AM shift',
   now() - interval '1 day' - interval '10 hours',
   now() - interval '1 day' - interval '9 hours 55 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '1 day' - interval '9 hours'),
  ('d4000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000008', 'd2000000-0000-0000-0000-000000000010',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'approved', 'Monthly walkthrough — all clear',
   now() - interval '28 days', now() - interval '28 days' + interval '25 minutes',
   'c0000000-0000-0000-0000-000000000001', now() - interval '27 days'),
  ('d4000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'completed', 'End of PM shift',
   now() - interval '1 day' - interval '18 hours',
   now() - interval '1 day' - interval '17 hours 40 minutes', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Run Answers ─────────────────────────────────────────────────
-- (Only insert if the run has no answers yet, to keep this idempotent)
INSERT INTO checklist_run_answers (run_id, item_id, answer_type, answer_value, answer_meta, item_config)
SELECT * FROM (VALUES
  -- Run 1: HACCP with freezer fail (approved)
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000030'::uuid, 'datetime', '2026-04-14T06:02:00-07:00', NULL::jsonb, NULL::jsonb),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000031'::uuid, 'employee_list', 'c0000000-0000-0000-0000-000000000001', '{"selected":["c0000000-0000-0000-0000-000000000001"]}'::jsonb, NULL),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000032'::uuid, 'temperature', '38', NULL, '{"unit":"F"}'::jsonb),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000033'::uuid, 'temperature', '8', NULL, '{"unit":"F"}'::jsonb),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000034'::uuid, 'number', '355', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000035'::uuid, 'yes_no', 'no', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000036'::uuid, 'text', 'Walk-in freezer read 8°F (above -10–0 range). Adjusted thermostat and opened maintenance ticket MX-2038.', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000037'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'd3000000-0000-0000-0000-000000000038'::uuid, 'signature', 'Billy Rainford', '{"name":"Billy Rainford","signed_at":"2026-04-14T06:14:00-07:00"}'::jsonb, NULL),
  -- Run 2: HACCP nominal (completed)
  ('d4000000-0000-0000-0000-000000000002'::uuid, 'd3000000-0000-0000-0000-000000000030'::uuid, 'datetime', (now())::text, NULL, NULL),
  ('d4000000-0000-0000-0000-000000000002'::uuid, 'd3000000-0000-0000-0000-000000000031'::uuid, 'employee_list', 'c0000000-0000-0000-0000-000000000001', '{"selected":["c0000000-0000-0000-0000-000000000001"]}'::jsonb, NULL),
  ('d4000000-0000-0000-0000-000000000002'::uuid, 'd3000000-0000-0000-0000-000000000032'::uuid, 'temperature', '37', NULL, '{"unit":"F"}'::jsonb),
  ('d4000000-0000-0000-0000-000000000002'::uuid, 'd3000000-0000-0000-0000-000000000033'::uuid, 'temperature', '-4', NULL, '{"unit":"F"}'::jsonb),
  ('d4000000-0000-0000-0000-000000000002'::uuid, 'd3000000-0000-0000-0000-000000000034'::uuid, 'number', '350', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000002'::uuid, 'd3000000-0000-0000-0000-000000000035'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000002'::uuid, 'd3000000-0000-0000-0000-000000000038'::uuid, 'signature', 'Billy Rainford', '{"name":"Billy Rainford"}'::jsonb, NULL),
  -- Run 3: Pre-Clean approved
  ('d4000000-0000-0000-0000-000000000003'::uuid, 'd3000000-0000-0000-0000-000000000001'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003'::uuid, 'd3000000-0000-0000-0000-000000000002'::uuid, 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003'::uuid, 'd3000000-0000-0000-0000-000000000003'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003'::uuid, 'd3000000-0000-0000-0000-000000000004'::uuid, 'select', 'Full clean', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003'::uuid, 'd3000000-0000-0000-0000-000000000005'::uuid, 'select', 'Pass (200ppm+)', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000003'::uuid, 'd3000000-0000-0000-0000-000000000007'::uuid, 'yes_no', 'no', NULL, NULL),
  -- Run 4: Incoming ingredient approved (minor damage)
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000050'::uuid, 'select', 'Pacific NW Flour Co.', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000051'::uuid, 'barcode_scan', 'PNW-AP-50LB-2026041104', '{"scanned_at":"2026-04-12T09:15:00-07:00"}'::jsonb, NULL),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000052'::uuid, 'number', '4', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000053'::uuid, 'radio', 'Minor damage', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000054'::uuid, 'photo', '/uploads/receiving/2026-04-12-pnw-damage.jpg', '{"uploaded_at":"2026-04-12T09:18:00-07:00"}'::jsonb, NULL),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000055'::uuid, 'temperature', '62', NULL, '{"unit":"F"}'::jsonb),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000056'::uuid, 'multi_select', 'Wheat', '{"selected":["Wheat"]}'::jsonb, NULL),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000057'::uuid, 'text_match', 'LOT-PNW-26041104-AP', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000058'::uuid, 'employee_list', 'c0000000-0000-0000-0000-000000000001', '{"selected":["c0000000-0000-0000-0000-000000000001"]}'::jsonb, NULL),
  ('d4000000-0000-0000-0000-000000000004'::uuid, 'd3000000-0000-0000-0000-000000000059'::uuid, 'signature', 'Billy Rainford', '{"name":"Billy Rainford"}'::jsonb, NULL),
  -- Run 5: Incoming in progress (partial)
  ('d4000000-0000-0000-0000-000000000005'::uuid, 'd3000000-0000-0000-0000-000000000050'::uuid, 'select', 'Cascade Dairy', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000005'::uuid, 'd3000000-0000-0000-0000-000000000051'::uuid, 'barcode_scan', 'CD-WB-5G-202604150', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000005'::uuid, 'd3000000-0000-0000-0000-000000000052'::uuid, 'number', '2', NULL, NULL),
  -- Run 6: Shift start approved
  ('d4000000-0000-0000-0000-000000000006'::uuid, 'd3000000-0000-0000-0000-000000000060'::uuid, 'datetime', '2026-04-14T05:58:00-07:00', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006'::uuid, 'd3000000-0000-0000-0000-000000000061'::uuid, 'employee_list', 'c0000000-0000-0000-0000-000000000001', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006'::uuid, 'd3000000-0000-0000-0000-000000000062'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006'::uuid, 'd3000000-0000-0000-0000-000000000064'::uuid, 'true_false', 'true', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006'::uuid, 'd3000000-0000-0000-0000-000000000065'::uuid, 'text', 'Mixer B still out for service — use Mixer A only today.', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000006'::uuid, 'd3000000-0000-0000-0000-000000000066'::uuid, 'signature', 'Billy Rainford', NULL, NULL),
  -- Run 7: Fire Safety approved
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000080'::uuid, 'datetime', '2026-03-18T10:00:00-07:00', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000081'::uuid, 'employee_list', 'c0000000-0000-0000-0000-000000000001', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000082'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000083'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000084'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000085'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000086'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000087'::uuid, 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000088'::uuid, 'datetime', '2026-01-15T09:00:00-08:00', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000007'::uuid, 'd3000000-0000-0000-0000-000000000089'::uuid, 'text', 'No deficiencies found.', NULL, NULL),
  -- Run 8: End of Shift Sanitation pending
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000010'::uuid, 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000011'::uuid, 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000012'::uuid, 'true_false', 'true', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000013'::uuid, 'select', 'Quaternary ammonia', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000014'::uuid, 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000015'::uuid, 'checkbox', 'checked', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000016'::uuid, 'yes_no', 'yes', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000017'::uuid, 'text', 'Noticed a slow drain near Sink 2 — flagged to maintenance.', NULL, NULL),
  ('d4000000-0000-0000-0000-000000000008'::uuid, 'd3000000-0000-0000-0000-000000000018'::uuid, 'checkbox', 'checked', NULL, NULL)
) AS t(run_id, item_id, answer_type, answer_value, answer_meta, item_config)
WHERE NOT EXISTS (
  SELECT 1 FROM checklist_run_answers a WHERE a.run_id = t.run_id AND a.item_id = t.item_id
);

-- ── Task Completions ────────────────────────────────────────────
INSERT INTO task_completions (id, task_id, completed_by, notes, period_start, period_end, status, completed_at, approved_by, approved_at, checklist_run_id) VALUES
  ('d6000000-0000-0000-0000-000000000001', 'ff000000-0000-0000-0000-000000000008',
   'c0000000-0000-0000-0000-000000000001',
   'Labels printed and applied to 24 variety packs. Verified GTIN barcodes scan correctly.',
   NULL, NULL, 'approved', now() - interval '1 day' - interval '2 hours',
   'c0000000-0000-0000-0000-000000000001', now() - interval '1 day' - interval '1 hour', NULL),
  ('d6000000-0000-0000-0000-000000000002', 'ff000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001',
   'Mixer B disassembled, cleaned, and reassembled. Beater showing wear — flagged for replacement.',
   NULL, NULL, 'pending', now() - interval '2 hours', NULL, NULL,
   'd4000000-0000-0000-0000-000000000003'),
  ('d6000000-0000-0000-0000-000000000003', 'ff000000-0000-0000-0000-000000000004',
   'c0000000-0000-0000-0000-000000000001',
   'Reviewed temperature logs for April 1–12.',
   '2026-04-01', '2026-04-12',
   'rejected', now() - interval '3 days',
   'c0000000-0000-0000-0000-000000000001', now() - interval '2 days 12 hours', NULL),
  ('d6000000-0000-0000-0000-000000000004', 'ff000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000001',
   'PO #PO-2026-0412 submitted to Mountain Sugar for 25 lbs poppy seeds.',
   NULL, NULL, 'pending', now() - interval '6 hours', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Grant new permissions to existing roles ─────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM permissions p
CROSS JOIN (
  SELECT DISTINCT role_id FROM role_permissions
  WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'tasks.view')
) rp
WHERE p.code IN ('checklists.run', 'checklists.approve', 'tasks.approve')
ON CONFLICT DO NOTHING;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Done! You should now have:
--   • 6 checklist categories + 5 task categories (all with colors)
--   • 9 checklist templates total (3 original + 6 new)
--   • 11 versions across various statuses (draft / review / approved / archived)
--   • 80+ items showcasing all 15 answer types
--   • 8 checklist runs (in_progress, completed, approved)
--   • 60+ run answers
--   • 4 task completions (pending, approved, rejected)
-- ═══════════════════════════════════════════════════════════════════
