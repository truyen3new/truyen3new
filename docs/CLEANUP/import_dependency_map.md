# Import Dependency Map - 2026-05-10

## Verification Summary

- Phase 1 dependency scans found no production imports for the Phase 3 delete candidates.
- Matches were limited to blueprint/docs references, the source files themselves, and documentation examples.
- Build validation passed after the auth-helper type fix, so cleanup can proceed from a green workspace.

## Delete Candidates

### `ci-trigger.txt`

- Production imports found: none.
- Workflow references found: none in `.github/`.

### `Code_changes.diff`

- Production imports found: none.
- Used only as a stale patch artifact and in blueprint/docs references.

### `Register.tsx`

- Production imports found: none.
- Workspace searches found only auth/register UI text references and the file itself; no import sites in `frontend/src`.

### `PR_60_REVIEW.md`

- Production imports found: none.
- Referenced only in cleanup planning docs.

### `API_Testing_Instructions.md`

- Production imports found: none.
- Superseded by consolidated testing documentation.

## Archive Candidates

### Scripts

- `setup-real-data.ps1`: referenced by `REAL_DATA_QUICKSTART.md` and its own header comments.
- `setup-real-data.sh`: referenced by `REAL_DATA_QUICKSTART.md` and its own header comments.
- `run_audit_tests.ps1`: referenced by `backend-supabase/run_audit_tests.ps1` comments and cleanup docs.

### SQL Examples

- `supabase_schema.sql`
- `supabase_setup.sql`
- `database.sql.example`
- `schema.sql.example`

These are documentation/example assets only; no production code imports were found.

## Risk Assessment

- Delete candidates: LOW risk.
- Archive candidates: LOW to MEDIUM risk because root documentation links will need later cross-reference updates.
