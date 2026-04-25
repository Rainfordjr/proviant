# Proviant - Technical Handoff Document

**Date:** April 13, 2026
**Project:** Proviant - SaaS Food Manufacturing Platform
**Stack:** Next.js 16.2.3 (App Router) + Supabase (PostgreSQL) + TypeScript + Tailwind CSS

---

## Overview

Proviant is a multi-tenant SaaS platform for food manufacturers (bakeries, production kitchens, packaged food companies) to manage recipes, production batches, inventory, compliance, and billing. Each organization gets isolated data through Supabase Row Level Security, a role-based permission system, and a modular feature set that can be activated per-org.

---

## Architecture

### Multi-Tenancy

Every data table includes an `org_id` foreign key. Supabase RLS policies enforce tenant isolation using `public.user_org_id()`, a SQL function that resolves the current user's organization. The service role key (`createAdminClient()`) bypasses RLS for platform-level admin operations.

### Authentication Flow

Supabase Auth handles user identity. The middleware (`src/middleware.ts`) refreshes auth tokens on every request and redirects unauthenticated users to `/login`. Signup goes through a server-side API route (`/api/auth/signup`) that uses the service role key to create the auth user, organization, user profile, admin role, core module activations, and trial subscription in sequence.

### Role-Based Access Control (RBAC)

The permission system supports 50+ granular permission codes organized by category (e.g., `recipes.view`, `batches.create`, `billing.manage`). Each organization defines its own roles, which can operate in whitelist mode (only checked permissions are allowed) or blacklist mode (everything except checked permissions is allowed). Admin roles bypass all permission checks. A `user_has_permission()` SQL function handles server-side enforcement, while `useRequirePermission()` and sidebar filtering handle client-side gating.

### Module System

Features are organized into modules. Core modules (dashboard, recipes, products, batches, materials, orders, customers, compliance) are always active. Premium modules (development, inventory-mapping, lot-traceability, analytics, api-integrations) can be activated per-org and have individual add-on pricing. The sidebar dynamically hides navigation items for inactive modules, and the role permission editor filters permissions to only show those relevant to active modules.

### Billing and Subscriptions

The billing system supports global plan tiers (Starter at $49/mo, Professional at $149/mo, Enterprise at $349/mo) with per-module add-ons. Key concepts include plan versioning (every edit creates an immutable snapshot so existing subscribers keep their terms), proration on mid-cycle plan changes (daily rate calculation, credit for unused days, charge for remaining days), a double-entry financial ledger for tracking charges/payments/credits/adjustments, and a referral program that auto-credits 10% of payments to the referring organization's ledger. New signups choose a plan during registration and receive a 14-day free trial.

### Platform Administration

A separate admin panel at `/admin` is gated by the `is_platform_admin` flag on the users table. It provides cross-org management including an overview dashboard with aggregate stats, organization management (subscription overrides, user lists, module activations, invoice history), a financial ledger per org (add charges, record payments, apply credits), global plan tier management with version history, user management across all orgs, and referral program administration.

---

## Database Schema

### Migrations (in order)

| Migration | Purpose |
|-----------|---------|
| `20260411000000_initial_schema.sql` | Core tables: organizations, users, products, suppliers, raw_materials, material_lots, batches, orders, haccp_plans, compliance_logs, warehouse_sites + RLS |
| `20260411100000_recipes_and_product_components.sql` | Recipes, recipe_ingredients, product_components (nested hierarchies) |
| `20260411200000_recipe_versioning_and_rnd.sql` | Recipe versions (draft/submitted/approved), dev_projects, dev_batch_notes, batch_type |
| `20260411300000_dynamic_rbac.sql` | Permissions (50+ codes), roles, user_roles, role_permissions, user_has_permission() |
| `20260411400000_customers.sql` | Customers table, links to orders |
| `20260412000000_role_mode_blacklist.sql` | Whitelist/blacklist mode on roles |
| `20260412100000_plugin_system.sql` | Modules catalog + org_modules (per-org activation), seeds 13 modules |
| `20260412200000_inventory_mapping.sql` | Warehouse sites, zones, racks, bins with capacity tracking |
| `20260412300000_permission_module_link.sql` | Links permissions to module_slug for dynamic filtering |
| `20260412400000_billing_plans.sql` | Plans, org_subscriptions, billing_invoices |
| `20260412500000_backfill_trial_subscriptions.sql` | Backfills existing orgs with trial subscriptions |
| `20260412600000_platform_admin.sql` | is_platform_admin flag on users |
| `20260412700000_tier_addon_pricing.sql` | Global plan tiers, subscription_addons, module pricing |
| `20260412800000_plan_versioning.sql` | plan_versions (immutable snapshots), current_version tracking |
| `20260412900000_proration_events.sql` | subscription_events, invoice_line_items |
| `20260413000000_ledger_referrals.sql` | ledger_entries, referrals, org_ledger_balance() function |

### Key Tables

**Core data:** organizations, users, products, recipes, recipe_versions, recipe_version_ingredients, batches, batch_ingredients, raw_materials, material_lots, suppliers, customers, orders, compliance_logs

**RBAC:** permissions, roles, user_roles, role_permissions

**Modules:** modules, org_modules

**Billing:** plans, plan_versions, org_subscriptions, subscription_addons, billing_invoices, invoice_line_items, subscription_events, ledger_entries, referrals

**Warehouse:** warehouse_sites, warehouse_zones, warehouse_racks, warehouse_bins

**R&D:** dev_projects, dev_batch_notes

---

## API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/auth/signup` | Public | User registration + org onboarding + plan selection |
| POST | `/api/auth/invite` | Admin | Invite team member to org |
| POST | `/api/billing/change-plan` | Authenticated | Upgrade/downgrade subscription with proration |
| GET | `/api/plans` | Public | List active plan tiers |
| POST | `/api/admin/plans` | Platform Admin | Create new plan tier |
| PUT | `/api/admin/plans` | Platform Admin | Update plan (creates new version) |
| POST | `/api/admin/subscription` | Platform Admin | Override org subscription |
| POST | `/api/admin/ledger` | Platform Admin | Add ledger entry |
| POST | `/api/admin/record-payment` | Platform Admin | Record payment + trigger referral credits |
| POST | `/api/admin/referrals` | Platform Admin | Create referral relationship |

---

## Page Structure

### Customer-Facing (`/(dashboard)/`)

The dashboard layout includes a permission-aware sidebar, a header with user menu and platform admin link, and a toast notification system.

**Core pages:** Dashboard, Recipes (CRUD + versioning + approval workflow), Products (CRUD + component hierarchy), Batches (production + dev batches with ingredient traceability), Materials (CRUD + stock levels), Customers (CRUD), Orders (CRUD with status tracking), Compliance (logging), Inventory (stock dashboard)

**Premium pages:** Development (R&D projects + test batch notes), Warehouse (visual layout editor with zones/racks/bins)

**Settings:** Users (role assignment with last-admin guard), Roles (permission toggles with whitelist/blacklist), Modules (activate/deactivate), Billing (subscription details + ledger balance + referral program + invoice history), Plans (plan comparison + selection)

### Platform Admin (`/admin/`)

Dark-themed admin panel with its own sidebar and header. Gated by `requirePlatformAdmin()` server-side check.

**Pages:** Overview (aggregate stats), Organizations (list + detail with subscription manager + ledger + referrals), Users (cross-org user list), Plans (tier management with version diffs), Referrals (program-wide tracking + manual creation)

---

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `sidebar.tsx` | `components/layout/` | Permission + module-aware navigation |
| `header.tsx` | `components/layout/` | User menu, notifications, admin panel link |
| `toast.tsx` | `components/ui/` | Global toast notification system (success/error/warning/info) |
| `permission-toggles.tsx` | `components/settings/` | Role permission editor with whitelist/blacklist |
| `user-role-manager.tsx` | `components/settings/` | Assign/remove roles with last-admin guard |
| `org-subscription-manager.tsx` | `components/admin/` | Admin subscription override |
| `org-ledger.tsx` | `components/admin/` | Financial ledger with charge/payment/credit actions |
| `plan-editor.tsx` | `components/admin/` | Plan tier editor with version creation |
| `referral-manager.tsx` | `components/admin/` | Referral program management |
| `version-actions.tsx` | `components/recipes/` | Recipe version approval workflow |

---

## Lib Utilities

| File | Purpose |
|------|---------|
| `constants.ts` | App name, status configs, compliance types, sidebar navigation definition |
| `utils.ts` | cn() (Tailwind merge), date formatting, batch/order number generation, expiry checks |
| `permissions.ts` | Server-side permission checking functions |
| `usePermission.ts` | Client-side permission hooks with redirect |
| `proration.ts` | Mid-cycle plan change calculation (daily rates, credits, charges) |
| `platformAdmin.ts` | requirePlatformAdmin() guard, createAdminClient() for service role access |
| `supabase/client.ts` | Browser-side Supabase client |
| `supabase/server.ts` | Server component Supabase client |
| `supabase/middleware.ts` | Auth token refresh + routing logic |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

For production, these would point to a hosted Supabase project. The service role key must be kept server-side only (never exposed to the client).

---

## Local Development Setup

1. Install dependencies: `npm install`
2. Start Supabase locally: `npx supabase start`
3. Apply migrations and seed: `npx supabase db reset`
4. Start dev server: `npm run dev`
5. Login: `admin@proviant.dev` / `admin123`

The seed creates a demo organization (Billy's Bakery) with suppliers, materials, recipes, batches, and a platform admin user with full permissions.

---

## Safeguards

The system includes protective measures to prevent users from locking themselves out. The last administrator role cannot be removed from a user (the UI checks how many admin role assignments exist org-wide before allowing removal and shows a toast warning if blocked). Permissions cannot be fully stripped from the last admin role. The role detail page displays a persistent warning banner when viewing the only active admin role. All safeguard violations surface via toast notifications rather than inline errors.

---

## Current Status

### Completed Features

- Multi-tenant organization management with RLS
- Full RBAC system with 50+ permissions, whitelist/blacklist modes
- Recipe management with versioning and approval workflow
- Production batch tracking with ingredient traceability
- R&D project management with dev batches and notes
- Raw materials and supplier management with stock tracking
- Customer and order management
- Compliance logging (temperature, sanitation, allergen, CCP)
- Warehouse layout management (sites, zones, racks, bins)
- Modular feature system (core + premium modules)
- Subscription billing with global plan tiers and per-module add-ons
- Plan versioning (immutable snapshots for subscriber protection)
- Mid-cycle proration on plan changes
- Double-entry financial ledger
- Referral program with automatic 10% credit on payments
- Platform super-admin panel for cross-org management
- Plan selection during signup with 14-day free trial
- Toast notification system
- Admin safeguards (last-admin protection)

### Pending / Future Work

- Payment gateway integration (currently billing is accounting-only, no Stripe)
- Usage-based billing (token/batch-count metering)
- Invoice PDF generation and email delivery
- Customer-facing invoice download
- Trial expiration enforcement (block access after 14 days if no plan selected)
- Lot traceability module (track ingredients through production to finished goods)
- Analytics module (production metrics, cost analysis, yield tracking)
- API integrations module (webhook system, third-party connections)
- Email notifications (batch completion, recipe approval, invoice due)
- Audit logging (who changed what, when)
- Data export (CSV/Excel for compliance reporting)
- Mobile-responsive layout optimization
- Automated testing suite
