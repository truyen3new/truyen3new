# Staging Runbook

This document describes how to deploy a staging environment and run the audit validation checklist.

Prerequisites
- Node.js and npm installed
- Supabase CLI and authenticated for the target project (optional but recommended)
- `DATABASE_URL` (or SUPABASE connection info) for running tests

Steps

1. Build frontend

```powershell
npm --prefix frontend run build
```

2. Deploy frontend
- Use your hosting provider CLI (Vercel/Netlify). Example (Vercel):

```powershell
npm i -g vercel
vercel --prod --confirm --token $VERCEL_TOKEN
```

3. Deploy Supabase migrations and functions

```powershell
cd backend-supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy increment-story-views
supabase functions deploy manage-story
supabase functions deploy manage-chapter
```

4. Run backend audit tests

```powershell
# From repo root
pwsh backend-supabase\run_audit_tests.ps1
# Or manually: psql $DATABASE_URL -f backend-supabase/supabase/tests/audit_validation.sql
```

5. Run frontend checks in staging
- Open staging site and verify:
  - Dark mode loads without FOUC
  - Admin route is only accessible to staff roles
  - Ad slots do not block main thread (observe network + RAIL)
  - Chapter auto-save and optimistic updates function

6. Run `docs/AUDIT_VALIDATION.md` checklist and record results

Rollback
- Revert commit(s) and re-deploy
- For DB rollbacks, follow migration revert steps documented in migrations folder

Contact
- For issues during staging, contact the backend engineer or the DevOps lead.