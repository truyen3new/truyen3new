# Root Inventory Report - 2026-05-10

## Snapshot

- Current root listing observed 44 entries, including dotfiles and local env files.
- Cleanup blueprint target treats the 38 non-hidden/root-visible project items as the cleanup scope.
- Validation status: frontend workspace build passes after a separate TypeScript fix in `frontend/src/lib/requestAuth.ts`.

## Categorization

### Keep

- `package.json`
- `package-lock.json`
- `README.md`
- `CONTRIBUTING.md`
- `tsconfig.json`
- `wrangler.jsonc`
- `skills-lock.json`
- `.gitignore`
- `.env.example`
- `.env`

### Evaluate / Consolidate Later

- `ARCHITECTURE.md`
- `LOCAL_TESTING_GUIDE.md`
- `REAL_DATA_QUICKSTART.md`
- `REAL_DATA_SETUP.md`
- `DEPLOYMENT_CHECKLIST_COMICS.md`
- `metadata.json`

### Delete in Phase 3

- `ci-trigger.txt`
- `Code_changes.diff`
- `Register.tsx`
- `PR_60_REVIEW.md`
- `API_Testing_Instructions.md`

### Archive in Phase 3

- `setup-real-data.ps1`
- `setup-real-data.sh`
- `run_audit_tests.ps1`
- `supabase_schema.sql`
- `supabase_setup.sql`
- `database.sql.example`
- `schema.sql.example`
- `SPRINT_3_ROADMAP.md`
- `AUDIT_REPORT.md`

## Notes

- No production code ownership was found for the delete candidates during the dependency scan.
- Documentation references to the archive candidates exist in markdown files only and will be reconciled in later documentation phases.
