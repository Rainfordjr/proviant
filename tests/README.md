# Tests

Test scripts that exercise the Proviant API end-to-end. These are not unit tests — they make real HTTP calls against a running dev server and a real local Supabase.

## Layout

- `api/` — end-to-end workflow tests, one per scenario.

## Running

```bash
# 1. Start Supabase + the Next dev server in another terminal
npx supabase start
npm run dev

# 2. Run a test
PROVIANT_URL=http://localhost:3000 \
  PROVIANT_EMAIL=admin@proviant.dev \
  PROVIANT_PASSWORD=admin123 \
  node tests/api/flow-customer-billing.mjs
```

For Claude or any automation use, mint a long-lived API key via `POST /api/auth/api-keys` and pass it as `PROVIANT_API_KEY` instead of credentials.

## What each test covers

| File | Workflow |
|------|----------|
| `api/flow-customer-billing.mjs` | Login → create customer + product → create order → confirm (auto-invoice) → record payment → verify state |

See `docs/CLAUDE_API_TESTING.md` for the full orientation and `docs/API.md` for the endpoint reference.
