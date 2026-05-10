# Real Data Setup Guide

## Purpose

This is the canonical guide for wiring the project to real Supabase and Cloudflare D1 data.

## Quick Start

### Supabase

From `backend-supabase/`:

```bash
supabase link --project-ref rwnzsmmfvsetfcnkjoxt
supabase db push
```

Load sample data by running `supabase/seed-sample-data.sql` in Supabase Studio or through `psql`.

### Cloudflare D1

From `backend-d1-saas/`:

```bash
npx wrangler d1 create saas-control-plane
npx wrangler d1 migrations apply saas-control-plane --remote
```

Then seed the tenant registry with the sample INSERT shown in the legacy setup guide.

## Frontend Wiring

Set the real-data variables in `frontend/.env.local`:

```env
SUPABASE_URL=https://rwnzsmmfvsetfcnkjoxt.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://rwnzsmmfvsetfcnkjoxt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_[your_key_here]
BACKEND_D1_SAAS_URL=http://localhost:8787
BACKEND_D1_SAAS_ADMIN_KEY=truyen3xxx_super_secret_key_3636_xnxx
NEXT_PUBLIC_INTERNAL_ADMIN_SECRET=internal-secret-placeholder
INTERNAL_ADMIN_SECRET=internal-secret-placeholder
```

Restart the frontend after updating the environment file:

```bash
cd frontend
npm run dev
```

## Verification

Test the internal admin endpoints:

```bash
curl -X GET "http://localhost:3001/api/internal/admin/taxonomy?type=categories" \
  -H "x-internal-secret: internal-secret-placeholder"

curl -X GET "http://localhost:3001/api/internal/admin/analytics/dashboard?range=7d" \
  -H "x-internal-secret: internal-secret-placeholder"
```

## Legacy Setup Scripts

The old root scripts were archived to:

- `docs/ARCHIVE/scripts-deprecated/setup-real-data.ps1`
- `docs/ARCHIVE/scripts-deprecated/setup-real-data.sh`

## Reference Data Shapes

- Supabase: categories, authors, stories, chapters, story_views, site_settings, audit_logs
- D1: tenants

## Reference Docs

- `docs/TESTING.md`
- `backend-supabase/docs/ANALYTICS_WORKER_SETUP.md`
- `backend-supabase/docs/db-schema.md`
