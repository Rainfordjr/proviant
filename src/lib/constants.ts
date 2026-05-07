// App-wide constants

export const APP_NAME = "Proviant";
export const APP_DESCRIPTION = "Food Manufacturing Management Platform";

// Batch statuses
export const BATCH_STATUSES = {
  planned: { label: "Planned", color: "bg-gray-100 text-gray-800" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  on_hold: { label: "On Hold", color: "bg-yellow-100 text-yellow-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
} as const;

// Order statuses
export const ORDER_STATUSES = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-800" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800" },
  processing: { label: "Processing", color: "bg-indigo-100 text-indigo-800" },
  shipped: { label: "Shipped", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
} as const;

// Recipe version statuses
export const VERSION_STATUSES = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-800" },
  submitted: { label: "Submitted for Review", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
} as const;

// Dev project statuses
export const DEV_PROJECT_STATUSES = {
  active: { label: "Active", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
} as const;

// Dev batch note types
export const DEV_NOTE_TYPES = {
  observation: { label: "Observation", color: "bg-blue-50 text-blue-700" },
  test_result: { label: "Test Result", color: "bg-purple-50 text-purple-700" },
  adjustment: { label: "Adjustment", color: "bg-orange-50 text-orange-700" },
  conclusion: { label: "Conclusion", color: "bg-green-50 text-green-700" },
} as const;

// ── Units of Measure ──────────────────────────────────────────────
// Grouped by category so future conversion logic can look up the
// category to decide which conversions are valid.
export interface UnitDef {
  value: string;
  label: string;
  category: "weight" | "volume" | "count";
}

export const UNITS: UnitDef[] = [
  // Weight
  { value: "lbs",   label: "Pounds (lbs)",    category: "weight" },
  { value: "oz",    label: "Ounces (oz)",      category: "weight" },
  { value: "kg",    label: "Kilograms (kg)",   category: "weight" },
  { value: "g",     label: "Grams (g)",        category: "weight" },
  // Volume
  { value: "gallons", label: "Gallons",        category: "volume" },
  { value: "liters",  label: "Liters",         category: "volume" },
  { value: "ml",      label: "Milliliters (ml)", category: "volume" },
  { value: "fl_oz",   label: "Fluid Ounces (fl oz)", category: "volume" },
  { value: "cups",    label: "Cups",           category: "volume" },
  { value: "tbsp",    label: "Tablespoons",    category: "volume" },
  { value: "tsp",     label: "Teaspoons",      category: "volume" },
  // Count / packaging
  { value: "each",   label: "Each",            category: "count" },
  { value: "dozen",  label: "Dozen",           category: "count" },
  { value: "units",  label: "Units",           category: "count" },
  { value: "cases",  label: "Cases",           category: "count" },
  { value: "bags",   label: "Bags",            category: "count" },
  { value: "packs",  label: "Packs",           category: "count" },
  { value: "loaves", label: "Loaves",          category: "count" },
];

// Flat list of valid unit values (useful for validation)
export const UNIT_VALUES = UNITS.map((u) => u.value);

// ── FDA Big 9 Allergens ──────────────────────────────────────────
export interface AllergenDef {
  value: string;
  label: string;
}

export const ALLERGENS: AllergenDef[] = [
  { value: "milk",       label: "Milk" },
  { value: "eggs",       label: "Eggs" },
  { value: "fish",       label: "Fish" },
  { value: "shellfish",  label: "Shellfish" },
  { value: "tree_nuts",  label: "Tree Nuts" },
  { value: "peanuts",    label: "Peanuts" },
  { value: "wheat",      label: "Wheat" },
  { value: "soy",        label: "Soy" },
  { value: "sesame",     label: "Sesame" },
];

// ── Material categories ──────────────────────────────────────────
export const MATERIAL_CATEGORIES = [
  { value: "Raw Material", label: "Raw Material" },
  { value: "WIP",          label: "Work in Progress (WIP)" },
] as const;

// ── Storage requirements ─────────────────────────────────────────
export const STORAGE_REQUIREMENTS = [
  { value: "Ambient",      label: "Ambient" },
  { value: "Refrigerated", label: "Refrigerated" },
  { value: "Frozen",       label: "Frozen" },
] as const;

// ── Shelf life units ─────────────────────────────────────────────
export const SHELF_LIFE_UNITS = [
  { value: "Days",   label: "Days" },
  { value: "Weeks",  label: "Weeks" },
  { value: "Months", label: "Months" },
  { value: "Years",  label: "Years" },
] as const;

// Compliance log types
export const COMPLIANCE_TYPES = {
  temperature: { label: "Temperature Check", icon: "Thermometer" },
  sanitation: { label: "Sanitation", icon: "SprayCanIcon" },
  allergen: { label: "Allergen Control", icon: "AlertTriangle" },
  ccp: { label: "Critical Control Point", icon: "Shield" },
  other: { label: "Other", icon: "FileText" },
} as const;

// Task statuses
export const TASK_STATUSES = {
  open: { label: "Open", color: "bg-gray-100 text-gray-800" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  review: { label: "In Review", color: "bg-purple-100 text-purple-800" },
  done: { label: "Done", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
} as const;

// Task priorities
export const TASK_PRIORITIES = {
  low: { label: "Low", color: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "High", color: "bg-orange-100 text-orange-800" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-800" },
} as const;

// Task types
export const TASK_TYPES = {
  general: { label: "General", color: "bg-gray-100 text-gray-700" },
  production: { label: "Production", color: "bg-blue-100 text-blue-700" },
  maintenance: { label: "Maintenance", color: "bg-amber-100 text-amber-700" },
  safety: { label: "Safety", color: "bg-red-100 text-red-700" },
  quality: { label: "Quality", color: "bg-purple-100 text-purple-700" },
  admin: { label: "Admin", color: "bg-slate-100 text-slate-700" },
} as const;

// Checklist answer types — matches stations/main app
export const CHECKLIST_ANSWER_TYPES = {
  checkbox:      { label: "Checkbox",        icon: "CheckSquare",  description: "Simple check/uncheck" },
  yes_no:        { label: "Yes / No",        icon: "ToggleLeft",   description: "Yes or No answer" },
  true_false:    { label: "True / False",    icon: "ToggleRight",  description: "True or False answer" },
  text:          { label: "Text",            icon: "Type",         description: "Free-form text response" },
  number:        { label: "Number",          icon: "Hash",         description: "Numeric value input" },
  select:        { label: "Dropdown",        icon: "ListOrdered",  description: "Single choice from dropdown" },
  radio:         { label: "Radio",           icon: "CircleDot",    description: "Single choice from radio buttons" },
  multi_select:  { label: "Multi-Select",    icon: "ListChecks",   description: "Choose multiple options" },
  photo:         { label: "Photo",           icon: "Camera",       description: "Photo upload" },
  datetime:      { label: "Date / Time",     icon: "CalendarClock", description: "Date and time picker" },
  temperature:   { label: "Temperature",     icon: "Thermometer",  description: "Temperature reading with unit" },
  employee_list: { label: "Employee",        icon: "UserCheck",    description: "Select from employee list" },
  barcode_scan:  { label: "Barcode Scan",    icon: "ScanBarcode",  description: "Barcode / QR scanner" },
  text_match:    { label: "Text Match",      icon: "TextSearch",   description: "OCR text matching validation" },
  signature:     { label: "Signature",       icon: "PenTool",      description: "Signature capture" },
} as const;

// Checklist condition operators — expanded to match stations/main
export const CHECKLIST_CONDITION_OPERATORS = {
  equals:     { label: "Equals" },
  not_equals: { label: "Does not equal" },
  contains:   { label: "Contains" },
  not_empty:  { label: "Is answered" },
  gt:         { label: "Greater than" },
  lt:         { label: "Less than" },
  gte:        { label: "Greater or equal" },
  lte:        { label: "Less or equal" },
} as const;

// Checklist version statuses (workflow)
export const CHECKLIST_VERSION_STATUSES = {
  draft:    { label: "Draft",     color: "bg-blue-50 text-blue-700",   border: "border-blue-200" },
  review:   { label: "In Review", color: "bg-amber-50 text-amber-700", border: "border-amber-200" },
  approved: { label: "Approved",  color: "bg-green-50 text-green-700", border: "border-green-200" },
  archived: { label: "Archived",  color: "bg-gray-50 text-gray-500",   border: "border-gray-200" },
} as const;

// Checklist run statuses
export const CHECKLIST_RUN_STATUSES = {
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  completed:   { label: "Completed",   color: "bg-yellow-100 text-yellow-800" },
  approved:    { label: "Approved",     color: "bg-green-100 text-green-800" },
} as const;

// Task completion approval statuses
export const TASK_COMPLETION_STATUSES = {
  pending:  { label: "Pending",  color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
} as const;

// Predefined category colors
export const CATEGORY_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
  "#84CC16", "#6366F1", "#14B8A6", "#A855F7",
] as const;

// Schedule priorities
export const SCHEDULE_PRIORITIES = {
  low: { label: "Low", color: "bg-gray-100 text-gray-600", border: "border-gray-300" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-700", border: "border-blue-400" },
  high: { label: "High", color: "bg-orange-100 text-orange-700", border: "border-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700", border: "border-red-400" },
} as const;

// User roles
export const USER_ROLES = {
  admin: { label: "Admin", description: "Full access to all features and settings" },
  manager: { label: "Manager", description: "Manage production, compliance, and orders" },
  operator: { label: "Operator", description: "Record data and view dashboards" },
} as const;

// Navigation
// Each item can have:
//   permission: the permission code needed to see this section (null = always visible)
//   requireAdmin: true if only admins can see it
//   children can also have a permission to control individual links
export interface NavChild {
  title: string;
  href: string;
  icon: string;
  permission?: string;      // hide this child if user lacks this permission
  requireAdmin?: boolean;
}

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  permission?: string;      // hide entire section if user lacks this permission
  requireAdmin?: boolean;   // hide entire section if user is not admin
  moduleSlug?: string;      // hide entire section if this module is not active for the org
  children?: NavChild[];
}

export const SIDEBAR_NAV: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
  },
  {
    title: "Recipes",
    href: "/recipes",
    icon: "ChefHat",
    permission: "recipes.view",
    children: [
      { title: "All Recipes", href: "/recipes", icon: "List", permission: "recipes.view" },
      { title: "New Recipe", href: "/recipes/new", icon: "Plus", permission: "recipes.create" },
    ],
  },
  {
    title: "Batches",
    href: "/batches",
    icon: "Package",
    permission: "batches.view",
    children: [
      { title: "All Batches", href: "/batches", icon: "List", permission: "batches.view" },
      { title: "New Batch", href: "/batches/new", icon: "Plus", permission: "batches.create" },
    ],
  },
  {
    title: "Production Schedule",
    href: "/production-schedule",
    icon: "CalendarDays",
    permission: "batches.view",
  },
  {
    title: "Materials",
    href: "/materials",
    icon: "Wheat",
    permission: "materials.view",
    children: [
      { title: "All Materials", href: "/materials", icon: "List", permission: "materials.view" },
      { title: "Add Material", href: "/materials/new", icon: "Plus", permission: "materials.create" },
    ],
  },
  {
    title: "Vendors",
    href: "/vendors",
    icon: "Truck",
    permission: "suppliers.view",
    children: [
      { title: "All Vendors", href: "/vendors", icon: "List", permission: "suppliers.view" },
      { title: "Add Vendor", href: "/vendors/new", icon: "Plus", permission: "suppliers.create" },
    ],
  },
  {
    title: "Products",
    href: "/products",
    icon: "ShoppingBag",
    permission: "products.view",
    children: [
      { title: "All Products", href: "/products", icon: "List", permission: "products.view" },
      { title: "Add Product", href: "/products/new", icon: "Plus", permission: "products.create" },
      { title: "Categories", href: "/products/categories", icon: "BarChart3", permission: "products.view" },
      { title: "UPC / GTIN Registry", href: "/products/identifiers", icon: "CreditCard", permission: "products.view" },
    ],
  },
  {
    title: "Compliance",
    href: "/compliance",
    icon: "ShieldCheck",
    permission: "compliance.view",
    children: [
      { title: "HACCP Plans", href: "/compliance/haccp", icon: "ClipboardCheck", permission: "compliance.view" },
      { title: "Logs", href: "/compliance/logs", icon: "FileText", permission: "compliance.view" },
      { title: "Reports", href: "/compliance/reports", icon: "BarChart3", permission: "compliance.view" },
    ],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: "Warehouse",
    permission: "inventory.view",
    children: [
      { title: "Stock Levels", href: "/inventory/stock", icon: "BarChart", permission: "inventory.view" },
      { title: "Purchase Orders", href: "/inventory/purchase-orders", icon: "Receipt", permission: "inventory.manage" },
    ],
  },
  {
    title: "Customers",
    href: "/customers",
    icon: "Users",
    permission: "customers.view",
    children: [
      { title: "All Customers", href: "/customers", icon: "List", permission: "customers.view" },
      { title: "Add Customer", href: "/customers/new", icon: "Plus", permission: "customers.create" },
      { title: "Delivery Routes", href: "/customers/routes", icon: "MapPin", permission: "customers.view" },
      { title: "Receivables", href: "/accounting/receivables", icon: "Wallet", permission: "customer_billing.view" },
    ],
  },
  {
    title: "Orders",
    href: "/orders",
    icon: "Truck",
    permission: "orders.view",
    children: [
      { title: "All Orders", href: "/orders", icon: "List", permission: "orders.view" },
      { title: "New Order", href: "/orders/new", icon: "Plus", permission: "orders.create" },
    ],
  },
  {
    title: "Development",
    href: "/development",
    icon: "FlaskConical",
    permission: "development.view",
    moduleSlug: "development",
    children: [
      { title: "Projects", href: "/development", icon: "List", permission: "development.view" },
      { title: "New Project", href: "/development/new", icon: "Plus", permission: "development.create" },
    ],
  },
  {
    title: "Warehouse",
    href: "/warehouse",
    icon: "Warehouse",
    permission: "warehouse.view",
    moduleSlug: "inventory-mapping",
    children: [
      { title: "All Sites", href: "/warehouse", icon: "List", permission: "warehouse.view" },
      { title: "New Site", href: "/warehouse/new", icon: "Plus", permission: "warehouse.create" },
    ],
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: "ClipboardCheck",
    permission: "tasks.view",
    moduleSlug: "tasks",
    children: [
      { title: "All Tasks", href: "/tasks", icon: "List", permission: "tasks.view" },
      { title: "New Task", href: "/tasks/new", icon: "Plus", permission: "tasks.create" },
      { title: "Completed", href: "/tasks/completed", icon: "CheckCircle2", permission: "tasks.view" },
      { title: "Checklists", href: "/tasks/checklists", icon: "ClipboardList", permission: "checklists.view" },
      { title: "Checklist Categories", href: "/tasks/checklists/categories", icon: "Palette", permission: "checklists.edit" },
      { title: "Task Categories", href: "/tasks/categories", icon: "Palette", permission: "tasks.view" },
      { title: "Departments", href: "/tasks/departments", icon: "Building2", permission: "departments.view" },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: "Settings",
    children: [
      { title: "Billing", href: "/settings/billing", icon: "CreditCard", permission: "billing.view" },
      { title: "Plans", href: "/settings/plans", icon: "DollarSign", permission: "billing.manage" },
      { title: "Modules", href: "/settings/modules", icon: "Store", permission: "modules.manage" },
      { title: "Roles & Permissions", href: "/settings/roles", icon: "Shield", requireAdmin: true },
      { title: "Users", href: "/settings/users", icon: "Users", requireAdmin: true },
      { title: "Organization", href: "/settings", icon: "Settings" },
    ],
  },
];
