# Test Suite for Comic Platform

This directory contains tests for RLS policies, Edge Functions, and Workers.

> **Note:** Some test implementation files referenced here are in development.  
> See `API_test.md` for Postman-based API integration tests (~202 test cases across all 48 endpoints).

## RLS Policy Tests

**File:** `backend-supabase/supabase/tests/rls-policies.test.sql` (planned)

Run against Supabase SQL Editor or via `psql`:

```bash
cd backend-supabase
supabase db push
# Then paste sql/test queries in Supabase Dashboard → SQL Editor
```

**Verify manually:**
1. Published stories: `SELECT * FROM public.stories WHERE status = 'published'` — public can read
2. Draft stories: `SELECT * FROM public.stories WHERE status = 'draft'` — only staff can see
3. Free chapters: public can read
4. VIP chapters: require premium/admin/superadmin role
5. Search RPC: `SELECT * FROM public.search_stories('[vector]', 10)` — accessible

## Edge Function Tests

Test locally with the Supabase emulator:

```bash
cd backend-supabase

# Start emulator
supabase start

# In another terminal, send test requests:
curl -X POST http://localhost:54321/functions/v1/payment_and_rewards \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_webhook", "data": {"user_id": "test-123", "amount": 9.99, "provider": "stripe"}}'

# Expected: { "recorded": true }

curl -X POST http://localhost:54321/functions/v1/payment_and_rewards \
  -H "Content-Type: application/json" \
  -d '{"type": "daily_checkin", "data": {"user_id": "test-123"}}'

# Expected: { "rewarded": true }
```

**Test scenarios:**
- Payment webhook creates payment record → `200`
- Daily checkin is idempotent → `200`
- Invalid JSON returns `400`
- Missing required fields return `400`

## R2 Worker Tests

Test the R2 proxy locally:

```bash
cd workers/r2-signed-url

# Start worker locally
npx wrangler dev

# In another terminal:
# Public asset
curl -I http://localhost:8787/public/test.txt

# VIP asset (no auth → 403)
curl -I http://localhost:8787/vip/test.txt

# VIP asset with JWT
curl -I -H "Authorization: Bearer <premium-jwt>" http://localhost:8787/vip/test.txt
```

## API Integration Tests (Postman / Newman)

The primary test suite is `API_test.md` — 202 test cases covering 48 endpoints:

```bash
npx newman run light-story-api.postman_collection.json \
  -e light-story-api.local.postman_environment.json \
  --reporters cli,junit
```

See `API_test.md` for full endpoint inventory and test case definitions.

## CI/CD Integration

```yaml
# In .github/workflows/ci.yml
- name: Postman API Tests
  run: npx newman run API_test.json -e postman/ci.env.json --reporters cli,junit

- name: Supabase Validation
  run: |
    cd backend-supabase
    supabase db push
    supabase functions deploy payment_and_rewards
```
