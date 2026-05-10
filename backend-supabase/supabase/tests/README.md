# Test Suite for Comic Platform

This directory contains tests for RLS policies, Edge Functions, and R2 Worker.

## RLS Policy Tests

**File:** `rls-policies.test.sql`

Run against your Supabase instance:

```bash
# Requires psql and Supabase connection
psql -h {db_host} -U {db_user} -d {db_name} -f backend-supabase/supabase/tests/rls-policies.test.sql
```

Or via Supabase CLI:

```bash
cd backend-supabase
supabase db push
# Then query in dashboard or via psql
```

Tests verify:
- Published stories are readable by public
- Draft stories are NOT readable by public
- Free chapters are readable by public
- VIP chapters require premium/admin role
- Search RPC is accessible

## Edge Function Tests

**File:** `payment_and_rewards.test.ts`

Run locally with Deno:

```bash
cd backend-supabase/supabase/functions/payment_and_rewards
deno test --allow-all payment_and_rewards.test.ts
```

Or in your local Supabase emulator:

```bash
cd backend-supabase
supabase functions serve payment_and_rewards

# In another terminal, send test requests:
curl -X POST http://localhost:54321/functions/v1/payment_and_rewards \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_webhook", "data": {"user_id": "test-123", "amount": 9.99, "provider": "stripe"}}'
```

Tests verify:
- Payment webhook creates payment record
- Daily checkin is idempotent
- Invalid JSON returns 400
- Missing required fields return 400
- Non-POST method returns 405

## R2 Worker Tests

**File:** `worker.test.js`

Run locally with Wrangler:

```bash
cd workers/r2-signed-url
wrangler test --local worker.test.js
```

Or with Node.js for mock tests:

```bash
node workers/r2-signed-url/worker.test.js
```

Tests verify:
- Public assets accessible without auth
- VIP assets blocked without auth
- VIP assets accessible with premium JWT
- Invalid JWT returns 401
- Missing auth returns 401
- Non-existent object returns 404
- Admin role can access VIP assets

## Running All Tests

```bash
# RLS tests
cd backend-supabase && supabase db push

# Edge Function tests
cd backend-supabase && supabase functions serve payment_and_rewards
# (Send test requests in separate terminal)

# R2 Worker tests
cd workers/r2-signed-url && wrangler test --local worker.test.js
```

## Integration Testing (E2E)

1. Apply migrations: `backend-supabase/supabase/scripts/apply_migrations.ps1`
2. Deploy Edge Function: `supabase functions deploy payment_and_rewards`
3. Deploy R2 Worker: `cd workers/r2-signed-url && wrangler publish`
4. Test end-to-end:
   - Upload image to R2
   - Create chapter with R2 image URL
   - Subscribe to chapter updates
   - Verify RLS policies block unauthorized access
   - Test R2 Worker VIP gating

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Run RLS Tests
  run: psql -h ${{ secrets.DB_HOST }} -U ${{ secrets.DB_USER }} -d ${{ secrets.DB_NAME }} -f backend-supabase/supabase/tests/rls-policies.test.sql

- name: Run Edge Function Tests
  run: cd backend-supabase && deno test --allow-all supabase/functions/payment_and_rewards/payment_and_rewards.test.ts

- name: Run R2 Worker Tests
  run: cd workers/r2-signed-url && npm test
```
