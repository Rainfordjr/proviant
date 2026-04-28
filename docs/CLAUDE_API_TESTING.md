# Testing Proviant via API (orientation for Claude)

This doc tells future Claude instances how to test Proviant programmatically. If you're reading this, the human probably asked you to verify a workflow, reproduce a bug, or smoke-test the API.

## Setup checklist

1. **App is running** — `npm run dev` against the local Supabase. Default base URL is `http://localhost:3000` (or `http://10.0.0.98:3000` if bound to LAN).
2. **Migrations applied** — `npx supabase migration up`. If you see "function does not exist" errors, this is probably the cause.
3. **You have credentials** — either:
   - An admin user (default seed: `admin@proviant.dev` / `admin123`)
   - An API key with the right scopes (mint via `POST /api/auth/api-keys` after logging in once)

## The API in one paragraph

Read `docs/API.md` for the full surface. The short version: `/api/auth/login` gives you a JWT; pass it as `Authorization: Bearer <jwt>`. Or mint a long-lived key via `/api/auth/api-keys` and pass it as `X-API-Key`. Every entity has a standard CRUD cluster (`/api/customers`, `/api/orders`, etc.). Orders have business-rule routes for atomic creation and status transitions. Customer billing has its own set of routes for invoices, credit notes, and payments — including live card charges via Authorize.Net and ACH initiation via Bill.com.

## How to authenticate from a test script

```js
// Login once, get an access token
const loginRes = await fetch("http://localhost:3000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@proviant.dev", password: "admin123" }),
});
const { access_token } = await loginRes.json();

// Use it on every subsequent call
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${access_token}`,
};
```

For long-running tests, mint an API key after the first login and use that — JWTs expire after an hour by default; API keys don't.

## Common workflows to test

**End-to-end customer billing flow** — see `tests/api/flow-customer-billing.mjs` for a runnable example. The shape:

1. Create a customer (`POST /api/customers`)
2. Create a product (`POST /api/products`)
3. Create an order with line items, atomically (`POST /api/orders`) — status starts as `pending`
4. Transition the order to `confirmed` (`POST /api/orders/[id]/transition-status`) — this triggers the auto-invoice
5. Verify the invoice exists (look at the customer's billing data)
6. Record a payment (`POST /api/customer-billing/payments`) applying it to the new invoice
7. Verify the invoice flips to `paid` and the customer's balance is zero

If any step misbehaves, the failure is almost always in the SQL function, the auto-invoice trigger, or a missing permission.

## Running the sample test

```bash
cd ~/Desktop/Proviant
PROVIANT_URL=http://localhost:3000 \
  PROVIANT_EMAIL=admin@proviant.dev \
  PROVIANT_PASSWORD=admin123 \
  node tests/api/flow-customer-billing.mjs
```

It logs each step and exits non-zero on the first failure. Read the output — it tells you exactly which assertion failed.

## Debugging an API call

Most error responses include the gateway message or Postgres error verbatim. Two common error shapes:

```json
// Validation failure
{ "error": "Invalid request body", "issues": [
  { "path": "amount", "message": "Expected number, received string" }
]}

// Permission failure
{ "error": "Missing permission: orders.create" }
```

If you get back HTML instead of JSON, you probably hit a 404 (wrong route) or 500 (unhandled crash, check `npm run dev` console).

If you get a 401 with "Invalid API key" but the key worked yesterday, check the `revoked_at` column — someone may have revoked it via `/api/auth/api-keys/[id]` DELETE.

## Things you can't currently do via /api/

These exist in the schema but don't have dedicated `/api/` routes yet — use Supabase's REST API directly (see the bottom of `docs/API.md`):

- Recipe versions, ingredients, sections
- Material lots, lot traceability
- Warehouse sites, zones, racks, bins
- Tasks, checklists, departments, task categories
- HACCP plans
- Product categories, identifiers, components
- Org modules / module activation

If a workflow you need touches one of these, ask the human whether to add a route or use the Supabase REST endpoint directly.

## Multi-tenancy reminder

Every `/api/*` route is org-scoped. An API key minted for org A literally cannot see or write data in org B — RLS would block it even if the route forgot a check. When you're testing across orgs, log in (or mint keys) per org.
