// Core database types matching our Supabase schema

export interface Organization {
  id: string;
  name: string;
  plan_tier: "free" | "starter" | "pro" | "enterprise";
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: "admin" | "manager" | "operator";
  is_platform_admin: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  org_id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RawMaterial {
  id: string;
  org_id: string;
  name: string;
  supplier_id: string | null;
  unit: string;
  reorder_point: number;
  current_stock: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaterialLot {
  id: string;
  material_id: string;
  lot_number: string;
  quantity: number;
  quantity_remaining: number;
  expiry_date: string | null;
  received_at: string;
  supplier_lot_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface Batch {
  id: string;
  org_id: string;
  product_id: string | null;
  recipe_id: string | null;
  recipe_version_id: string | null;
  batch_number: string;
  batch_type: "production" | "development";
  status: "planned" | "in_progress" | "completed" | "on_hold" | "rejected";
  quantity_produced: number | null;
  produced_at: string | null;
  notes: string | null;
  dev_project_id: string | null;
  // Production schedule fields
  scheduled_date: string | null;
  assigned_to: string | null;
  estimated_duration_hours: number | null;
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
  // Joined fields
  product?: Product;
  recipes?: Recipe;
  recipe_version?: RecipeVersion;
  dev_project?: DevProject;
  ingredients?: BatchIngredient[];
  dev_notes?: DevBatchNote[];
  assigned_user?: User;
  resource_assignments?: ScheduleResourceAssignment[];
  product_allocations?: BatchProductAllocation[];
}

export interface BatchIngredient {
  id: string;
  batch_id: string;
  material_lot_id: string;
  quantity_used: number;
  // Joined fields
  material_lot?: MaterialLot & { raw_material?: RawMaterial };
}

export interface ComplianceLog {
  id: string;
  org_id: string;
  type: "temperature" | "sanitation" | "allergen" | "ccp" | "other";
  ccp_id: string | null;
  value: string;
  recorded_by: string;
  recorded_at: string;
  notes: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  org_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  ordered_at: string;
  shipped_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  batch_id: string | null;
  quantity: number;
  unit_price: number;
  // Joined fields
  product?: Product;
  batch?: Batch;
}

// ============================================================
// Recipes & Product Components
// ============================================================

export interface Recipe {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  yield_quantity: number;
  yield_unit: string;
  is_active: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  current_version?: RecipeVersion;
  versions?: RecipeVersion[];
  ingredients?: RecipeIngredient[];
}

export type RecipeVersionStatus = "draft" | "submitted" | "approved" | "rejected";

export interface RecipeVersion {
  id: string;
  recipe_id: string;
  version_number: number;
  status: RecipeVersionStatus;
  yield_quantity: number;
  yield_unit: string;
  instructions: string | null;
  change_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_notes: string | null;
  // Joined fields
  recipes?: Recipe;
  ingredients?: RecipeVersionIngredient[];
  creator?: User;
  approver?: User;
}

export interface RecipeVersionIngredient {
  id: string;
  recipe_version_id: string;
  raw_material_id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  sort_order: number;
  created_at: string;
  // Joined fields
  raw_materials?: RawMaterial;
}

// Keep old interface for backward compat with recipe_ingredients table
export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  raw_material_id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  sort_order: number;
  created_at: string;
  // Joined fields
  raw_materials?: RawMaterial;
}

export interface ProductComponent {
  id: string;
  product_id: string;
  component_type: "recipe" | "product";
  recipe_id: string | null;
  recipe_version_id: string | null;
  component_product_id: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  created_at: string;
  // Joined fields
  recipes?: Recipe;
  products?: Product;
}

// ============================================================
// Product Development / R&D
// ============================================================

export interface DevProject {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "cancelled";
  target_recipe_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  target_recipe?: Recipe;
  creator?: User;
  batches?: Batch[];
}

export interface DevBatchNote {
  id: string;
  batch_id: string;
  note_type: "observation" | "test_result" | "adjustment" | "conclusion";
  content: string;
  recorded_by: string | null;
  created_at: string;
  // Joined fields
  recorder?: User;
}

// ============================================================
// RBAC (Role-Based Access Control)
// ============================================================

export interface Permission {
  id: string;
  code: string;
  category: string;
  name: string;
  description: string | null;
  module_slug: string | null;
}

export interface Role {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_admin: boolean;
  mode: "whitelist" | "blacklist";
  created_at: string;
  updated_at: string;
  // Joined fields
  permissions?: Permission[];
  role_permissions?: RolePermission[];
  user_count?: number;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
  // Joined fields
  permissions?: Permission;
}

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  // Joined fields
  roles?: Role;
  users?: User;
}

export interface Module {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_free: boolean;
  price_monthly: number | null;
  price_yearly: number | null;
  is_core: boolean;
  sort_order: number;
  created_at: string;
}

export interface OrgModule {
  id: string;
  org_id: string;
  module_id: string;
  is_active: boolean;
  activated_at: string;
  deactivated_at: string | null;
  activated_by: string | null;
  // Joined fields
  modules?: Module;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  max_users: number | null;
  max_batches_per_month: number | null;
  included_modules: string[];
  is_active: boolean;
  is_featured: boolean;
  badge: string | null;
  current_version: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlanVersion {
  id: string;
  plan_id: string;
  version: number;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  max_users: number | null;
  max_batches_per_month: number | null;
  included_modules: string[];
  change_notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SubscriptionAddon {
  id: string;
  org_id: string;
  module_slug: string;
  is_active: boolean;
  activated_at: string;
  deactivated_at: string | null;
}

export interface OrgSubscription {
  id: string;
  org_id: string;
  plan_id: string | null;
  plan_version_id: string | null;
  billing_type: "plan" | "custom";
  custom_rate_monthly: number | null;
  custom_rate_yearly: number | null;
  custom_notes: string | null;
  billing_cycle: "monthly" | "yearly";
  status: "active" | "trial" | "past_due" | "cancelled" | "suspended";
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  plans?: Plan;
  plan_versions?: PlanVersion;
}

export interface BillingInvoice {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  status: "pending" | "paid" | "overdue" | "void";
  description: string | null;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface LedgerEntry {
  id: string;
  org_id: string;
  entry_type: "charge" | "payment" | "credit" | "referral_credit" | "adjustment" | "refund";
  amount: number;
  running_balance: number | null;
  description: string;
  invoice_id: string | null;
  event_id: string | null;
  referral_id: string | null;
  reference_number: string | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_org_id: string;
  referred_org_id: string;
  referral_code: string;
  status: "active" | "inactive" | "expired";
  credit_rate: number;
  total_credits_earned: number;
  created_at: string;
  // Joined fields
  referred_org?: { name: string };
  referrer_org?: { name: string };
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  line_type: "plan" | "addon" | "credit" | "proration_credit" | "proration_charge" | "adjustment";
  amount: number;
  module_slug: string | null;
  event_id: string | null;
  created_at: string;
}

// ============================================================
// Checklists & Tasks (Enhanced)
// ============================================================

export type ChecklistAnswerType =
  | "checkbox"
  | "yes_no"
  | "true_false"
  | "text"
  | "select"
  | "number"
  | "photo"
  | "datetime"
  | "temperature"
  | "radio"
  | "multi_select"
  | "employee_list"
  | "barcode_scan"
  | "text_match"
  | "signature";

export type ChecklistVersionStatus = "draft" | "review" | "approved" | "archived";

export type ChecklistRunStatus = "in_progress" | "completed" | "approved";

export type TaskCompletionStatus = "pending" | "approved" | "rejected";

export type ChecklistConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_empty"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export interface ChecklistCategory {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskCategory {
  id: string;
  org_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplate {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  category_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  creator?: { id: string; full_name: string } | null;
  category?: ChecklistCategory | null;
  versions?: ChecklistTemplateVersion[];
}

export interface ChecklistTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  notes: string | null;
  is_published: boolean;
  status: ChecklistVersionStatus;
  created_by: string | null;
  created_at: string;
  submitted_for_review_by: string | null;
  submitted_for_review_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  archived_by: string | null;
  archived_at: string | null;
  // Joined fields
  creator?: { id: string; full_name: string } | null;
  approver?: { id: string; full_name: string } | null;
  checklist_template_items?: ChecklistTemplateItem[];
}

export interface ChecklistTemplateItem {
  id: string;
  version_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  answer_type: ChecklistAnswerType;
  answer_options: string[] | null;
  config: Record<string, unknown> | null;
  condition_item_id: string | null;
  condition_operator: ChecklistConditionOperator | null;
  condition_value: string | null;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  is_checked: boolean;
  answer_type: ChecklistAnswerType;
  answer_options: string[] | null;
  answer_value: string | null;
  answer_meta: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  condition_item_id: string | null;
  condition_operator: ChecklistConditionOperator | null;
  condition_value: string | null;
  checked_by: string | null;
  checked_at: string | null;
  source_template_id: string | null;
  source_version_id: string | null;
  source_item_id: string | null;
  // Joined fields
  checker?: { id: string; full_name: string } | null;
}

export interface ChecklistRun {
  id: string;
  org_id: string;
  checklist_id: string;
  version_id: string;
  started_by: string | null;
  completed_by: string | null;
  status: ChecklistRunStatus;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  // Joined fields
  checklist?: ChecklistTemplate;
  version?: ChecklistTemplateVersion;
  starter?: { id: string; full_name: string } | null;
  completer?: { id: string; full_name: string } | null;
  approver?: { id: string; full_name: string } | null;
  answers?: ChecklistRunAnswer[];
}

export interface ChecklistRunAnswer {
  id: string;
  run_id: string;
  item_id: string;
  answer_type: ChecklistAnswerType;
  answer_value: string | null;
  answer_meta: Record<string, unknown> | null;
  item_config: Record<string, unknown> | null;
  created_at: string;
  // Joined fields
  item?: ChecklistTemplateItem;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_by: string | null;
  notes: string | null;
  period_start: string | null;
  period_end: string | null;
  status: TaskCompletionStatus;
  completed_at: string;
  approved_by: string | null;
  approved_at: string | null;
  checklist_run_id: string | null;
  created_at: string;
  // Joined fields
  completer?: { id: string; full_name: string } | null;
  approver?: { id: string; full_name: string } | null;
  checklist_run?: ChecklistRun | null;
}

// ============================================================
// Production Schedule / Equipment
// ============================================================

export interface Equipment {
  id: string;
  org_id: string;
  name: string;
  equipment_type: string;
  is_available: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleResourceAssignment {
  id: string;
  batch_id: string;
  resource_type: "equipment" | "labor";
  resource_id: string;
  created_at: string;
  // Joined fields
  equipment?: Equipment;
  user?: User;
}

export interface BatchProductAllocation {
  id: string;
  batch_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  created_at: string;
  // Joined fields
  product?: Product;
}
