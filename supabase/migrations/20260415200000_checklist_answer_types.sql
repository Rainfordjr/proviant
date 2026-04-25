-- ── Answer types + conditional logic for checklist items ─────────
-- Adds answer_type, answer_options, and condition fields to both
-- template items and task-level items.

-- Answer types: checkbox (default), yes_no, true_false, text, select
-- Conditions: an item can depend on another item's answer value

-- ── Template items ──────────────────────────────────────────────
ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS answer_type    TEXT NOT NULL DEFAULT 'checkbox',
  ADD COLUMN IF NOT EXISTS answer_options JSONB,
  ADD COLUMN IF NOT EXISTS condition_item_id UUID REFERENCES checklist_template_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condition_operator TEXT,
  ADD COLUMN IF NOT EXISTS condition_value   TEXT;

COMMENT ON COLUMN checklist_template_items.answer_type IS 'checkbox | yes_no | true_false | text | select';
COMMENT ON COLUMN checklist_template_items.answer_options IS 'For select type: ["Option A","Option B",...]';
COMMENT ON COLUMN checklist_template_items.condition_item_id IS 'If set, this item is only shown when the referenced item matches the condition';
COMMENT ON COLUMN checklist_template_items.condition_operator IS 'equals | not_equals | contains | not_empty';
COMMENT ON COLUMN checklist_template_items.condition_value IS 'The value to compare against (null for not_empty operator)';

-- ── Task checklist items ────────────────────────────────────────
ALTER TABLE task_checklist_items
  ADD COLUMN IF NOT EXISTS answer_type      TEXT NOT NULL DEFAULT 'checkbox',
  ADD COLUMN IF NOT EXISTS answer_options   JSONB,
  ADD COLUMN IF NOT EXISTS answer_value     TEXT,
  ADD COLUMN IF NOT EXISTS condition_item_id UUID REFERENCES task_checklist_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condition_operator TEXT,
  ADD COLUMN IF NOT EXISTS condition_value   TEXT,
  ADD COLUMN IF NOT EXISTS source_item_id   UUID;

COMMENT ON COLUMN task_checklist_items.answer_value IS 'The actual response: "yes"/"no", free text, selected option, "true"/"false", or "checked"';
COMMENT ON COLUMN task_checklist_items.source_item_id IS 'Original template item ID (for mapping conditions when copying)';
