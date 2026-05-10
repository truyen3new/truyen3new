# Cleanup Scope - May 10, 2026

## Files to Delete

- `ci-trigger.txt` - stale CI artifact
- `Code_changes.diff` - abandoned patch file
- `Register.tsx` - orphaned component
- `PR_60_REVIEW.md` - old review notes
- `API_Testing_Instructions.md` - superseded by consolidated testing docs

## Files to Archive

- `setup-real-data.ps1` → `docs/ARCHIVE/scripts-deprecated/`
- `setup-real-data.sh` → `docs/ARCHIVE/scripts-deprecated/`
- `run_audit_tests.ps1` → `docs/ARCHIVE/scripts-deprecated/`
- `supabase_schema.sql` → `docs/ARCHIVE/sql-examples/`
- `supabase_setup.sql` → `docs/ARCHIVE/sql-examples/`
- `database.sql.example` → `docs/ARCHIVE/sql-examples/`
- `schema.sql.example` → `docs/ARCHIVE/sql-examples/`
- `SPRINT_3_ROADMAP.md` → `docs/ARCHIVE/sprints/`
- `AUDIT_REPORT.md` → `docs/ARCHIVE/audits/`

## Documentation to Consolidate

- `ARCHITECTURE.md` + `frontend/ARCHITECTURE.md` → `docs/ARCHITECTURE.md`
- `LOCAL_TESTING_GUIDE.md` + backend testing docs → `docs/TESTING.md`
- `REAL_DATA_QUICKSTART.md` + `REAL_DATA_SETUP.md` → `docs/REAL_DATA.md`
- `DEPLOYMENT_CHECKLIST_COMICS.md` → review against `docs/STAGING_RUNBOOK.md`
- `README.md` → trim to navigation and quick links

## Verification Steps

- Phase 3: build must pass after deletions and archives
- Phase 4: documentation consolidation with no content loss
- Phase 6: all links verified

## Rollback Procedure

- `git reset --hard cleanup-baseline-2026-05-10`
