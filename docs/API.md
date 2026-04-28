# Proviant API

This document covers every Proviant `/api/*` endpoint. Direct CRUD on most domain tables also works through Supabase's auto-generated REST API at `<SUPABASE_URL>/rest/v1/<table>`, but the routes here are the canonical, business-rule-enforcing surface.

## Base URL

`http://10.0.0.98:3000/api` for local dev (use whatever host your `npm run dev` is bound to).

## Authentication

Every state-changing endpoint requires authentication. Three methods are supported:

### 1. Cookie session (browser)

What the UI uses. Nothing extra needed when calling from the same origin in a browser.

### 2. Bearer JWT (scripts, dev tools)

Get a JWT from `POST /api/auth/login`, then send it on every subsequent request:

```
Authorization: Bearer <access_token>
```

The JWT carries the user's identity; the same RBAC permission system applies as for the UI.

### 3. API key (production integrations, automated testing)

Mint a key via `POST /api/auth/api-keys`. Send it on every request:

```
X-API-Key: pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

API keys carry a `scopes` array of permission codes. A scope of `"*"` is wildcard. The key is org-scoped — every action it takes is constrained to the org that minted it.

## Response shape

Every successful response is JSON. List endpoints return:

```json
{
  "data": [ ... ],
  "pagination": { "limit": 100, "offset": 0, "total": 245 }
}
```

Single-row endpoints return:

```json
{ "data": { ... } }
```

Errors return:

```json
{ "error": "Human-readable message", "issues": [ ... ] }
```

`issues` only appears for Zod validation failures (HTTP 400) and contains `[{ "path": "field.name", "message": "..." }]`.

## Auth endpoints

### `POST /api/auth/login`

Trade email + password for a session token.

```json
// request
{ "email": "admin@proviant.dev", "password": "admin123" }

// response
{
  "access_token": "eyJhbGc...",
  "refresh_token": "...",
  "expires_at": 1735689600,
  "user": { "id": "uuid", "email": "admin@proviant.dev" }
}
```

### `POST /api/auth/refresh`

Renew an expired access token.

```json
// request
{ "refresh_token": "..." }

// response: same shape as login (without user)
```

### `POST /api/auth/signup`

Public. Creates a new user, organization, admin role, and trial subscription.

```json
{
  "email": "user@example.com",
  "password": "minimum-8-chars",
  "fullName": "Jane Doe",
  "orgName": "Acme Bakery",
  "planId": "uuid (optional)",
  "referralCode": "ACME-1234 (optional)"
}
```

### `POST /api/auth/invite`

Invite a teammate. Requires `users.create` permission.

```json
{ "email": "teammate@example.com", "fullName": "John Smith", "roleId": "uuid (optional)" }
```

## API keys

Requires `api_keys.manage` permission.

### `GET /api/auth/api-keys`

List the org's keys (with values masked).

### `POST /api/auth/api-keys`

Mint a new key. **The plaintext key is shown only in this response.**

```json
// request
{
  "name": "Claude testing",
  "scopes": ["customers.view", "customers.create", "orders.view", "orders.create"],
  "notes": "Used by automated API tests"
}

// response
{
  "success": true,
  "key": { "id": "uuid", "name": "Claude testing", "key_prefix": "pk_a1b2c3", "scopes": [...] },
  "plaintext": "pk_a1b2c3d4e5...",
  "warning": "Save this key now — it will not be shown again."
}
```

For full access, use `["*"]` as the scope. For read-only, list only the `*.view` permissions you care about.

### `DELETE /api/auth/api-keys/[id]`

Revoke a key (soft delete).

## CRUD entities

Each of these supports the same five operations:

- `GET    /api/<resource>          ` — list (supports `?limit=`, `?offset=`, `?sort=`, `?order=asc|desc`, `?q=` text search, plus exact-match filters)
- `POST   /api/<resource>          ` — create
- `GET    /api/<resource>/[id]     ` — fetch one
- `PATCH  /api/<resource>/[id]     ` — partial update
- `DELETE /api/<resource>/[id]     ` — delete

Resources currently exposed:

| Resource         | Path                  | Permissions                                       | Searchable             | Filterable               |
|------------------|-----------------------|---------------------------------------------------|------------------------|--------------------------|
| Customers        | `/api/customers`      | `customers.view/create/edit/delete`               | name, contact_name, email | is_active             |
| Products         | `/api/products`       | `products.view/create/edit/delete`                | name, sku, description | is_active, category      |
| Recipes          | `/api/recipes`        | `recipes.view/create/edit/delete`                 | name, description      | is_active                |
| Batches          | `/api/batches`        | `batches.view/create/edit/delete`                 | batch_number, notes    | status, product_id       |
| Raw materials    | `/api/raw-materials`  | `materials.view/create/edit/delete`               | name, description      | is_active, supplier_id   |
| Suppliers        | `/api/suppliers`      | `suppliers.view/create/edit`                      | name, contact_name, email | is_active             |
| Compliance logs  | `/api/compliance-logs`| `compliance.view/create/edit`                     | value, ccp_id, notes   | type                     |

### Body shapes

The Zod schemas in each route file are the source of truth — see `src/app/api/<resource>/route.ts`. Quick reference:

**customers**: `name` (required), `contact_name?`, `email?`, `phone?`, `address?`, `city?`, `state?`, `zip?`, `notes?`, `is_active?`

**products**: `name` (required), `sku` (required, unique per org), `category?`, `unit?`, `description?`, `is_active?`

**recipes**: `name` (required), `description?`, `instructions?`, `yield_quantity?`, `yield_unit?`, `is_active?`

**batches**: `product_id` (required), `batch_number` (required), `status?`, `quantity_produced?`, `produced_at?`, `notes?`

**raw-materials**: `name` (required), `supplier_id?`, `unit?`, `reorder_point?`, `current_stock?`, `description?`, `is_active?`

**suppliers**: `name` (required), `contact_name?`, `email?`, `phone?`, `address?`, `notes?`, `is_active?`

**compliance-logs**: `type` (one of `temperature`, `sanitation`, `allergen`, `ccp`, `other`), `ccp_id?`, `value` (required), `notes?` — also requires user-backed auth (recorded_by).

## Orders

Orders have business rules beyond plain CRUD.

### `POST /api/orders`

Create an order with line items, atomically. `Idempotency-Key` header is honored.

```json
{
  "order_number": "ORD-2026-0001",
  "customer_id": "uuid (optional, walk-in if omitted)",
  "customer_name": "Pike Place Market Cafe",
  "customer_email": "orders@pikeplace.com",
  "status": "pending (optional, defaults to pending)",
  "notes": "Deliver by Friday",
  "ordered_at": "2026-04-29T10:00:00Z (optional)",
  "items": [
    { "product_id": "uuid", "quantity": 5, "unit_price": 12.50 },
    { "product_id": "uuid", "quantity": 2, "unit_price": 8.00 }
  ]
}
```

### `POST /api/orders/[id]/transition-status`

Move an order through its workflow. The legal transitions are:

- `pending` → `confirmed`, `cancelled`
- `confirmed` → `processing`, `cancelled`
- `processing` → `shipped`, `cancelled`
- `shipped` → `delivered`, `cancelled`
- `delivered`, `cancelled` → terminal

Skipping steps returns 422. Transitioning to `shipped` sets `shipped_at = now()`. Transitioning to `confirmed` triggers the auto-invoice flow if the order has a `customer_id`.

```json
// request
{ "status": "confirmed" }

// response
{ "data": { ...updated order... } }
```

### `GET/PATCH/DELETE /api/orders/[id]`

Standard CRUD. PATCH does not allow editing `status` — use the transition endpoint.

## Customer billing

### `POST /api/customer-billing/invoices`

Create a manual invoice (for things outside the order workflow). Requires `customer_billing.manage`.

```json
{
  "customer_id": "uuid",
  "issued_at": "2026-04-29T00:00:00Z (optional)",
  "due_at": "2026-05-29T00:00:00Z (optional)",
  "notes": "Late delivery surcharge",
  "order_id": null,
  "line_items": [
    { "description": "Late fee", "quantity": 1, "unit_price": 25.00 }
  ]
}
```

### `POST /api/customer-billing/invoices/[id]/void`

Void an invoice. Returns 400 if any payments are applied — reverse the payments first.

### `POST /api/customer-billing/credit-notes`

Issue a credit note (negative invoice). Same shape as invoices, stored with `kind='credit_note'` and a negative total.

### `POST /api/customer-billing/payments`

Record a payment manually (for cash/check/etc.). `Idempotency-Key` header is honored.

```json
{
  "customer_id": "uuid",
  "amount": 100.00,
  "method": "check",
  "reference_number": "Check #1234",
  "notes": "...",
  "received_at": "2026-04-29T14:00:00Z (optional)",
  "applications": [
    { "invoice_id": "uuid", "amount": 80.00 }
  ]
}
```

Any unallocated portion sits as credit on the customer's account.

### `POST /api/customer-billing/charge-card`

Charge a customer's card via Authorize.Net. Requires `customer_billing.manage`. Tokenization is via Accept.js in the browser; this endpoint receives only the opaque token, never raw card data.

```json
{
  "customer_id": "uuid",
  "amount": 100.00,
  "opaque_data": { "dataDescriptor": "...", "dataValue": "..." },
  "invoice_number": "INV-2026-0001 (optional, shows in Authorize.Net dashboard)",
  "description": "...",
  "notes": "...",
  "applications": [...]
}
```

Returns 402 on decline with the gateway's message and no payment row.

### `POST /api/customer-billing/initiate-ach`

Initiate an ACH transfer via Bill.com. The Bill.com submission itself is currently stubbed — recorded ACH payments stay in `gateway_status='pending'` until manually marked cleared.

```json
{
  "customer_id": "uuid",
  "amount": 500.00,
  "routing_number": "021000021",
  "account_number": "1234567890",
  "account_holder_name": "Acme Bakery",
  "account_type": "checking",
  "applications": [...]
}
```

### Gateway settings

- `GET /api/customer-billing/gateway-settings` — fetch (secrets masked)
- `PUT /api/customer-billing/gateway-settings` — update (omit a field to leave it unchanged)
- `GET /api/customer-billing/auth-net-config` — public-by-design Authorize.Net fields for browser tokenization

## Subscription / platform billing (Proviant ↔ org)

These are the SaaS subscription routes — not customer A/R.

- `GET  /api/plans` — public, list active plan tiers
- `POST /api/billing/change-plan` — `{ newPlanId }` (requires `billing.manage`, supports `Idempotency-Key`)

### Platform admin only

Require `is_platform_admin = true` on the user.

- `POST /api/admin/plans` / `PUT /api/admin/plans` — create or update a plan tier
- `POST /api/admin/subscription` — override an org's subscription
- `POST /api/admin/ledger` — add a ledger entry (charge/credit/etc.)
- `POST /api/admin/record-payment` — record a payment + auto-credit referrer
- `POST /api/admin/referrals` — create a referral link

## Direct Supabase access

Anything not exposed as `/api/*` (warehouse layout, tasks, departments, recipe versions, etc.) is reachable via Supabase's REST API:

```bash
curl "<SUPABASE_URL>/rest/v1/<table>?org_id=eq.<your-org>" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <user_jwt>"
```

RLS handles tenant isolation. Permissions on individual columns/operations follow the policies on each table. Anything that has business rules beyond plain CRUD should grow a `/api/*` route eventually.
