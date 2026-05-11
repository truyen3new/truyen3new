# Test Report: CMS Refactor Validation Plan

Date: 2026-05-11

## Scope

- Verify lifecycle transitions for comics and chapters.
- Verify Worker RBAC boundaries and ownership checks.
- Verify Smart Upload ordering, conversion, and cache invalidation.
- Verify audit logging and draft recovery behavior.

## Validation Status

- This workflow produced a design/package of artifacts only.
- No runtime migration or Worker execution was run in this pass.

## Required Test Cases

- Draft -> pending -> published -> archived transitions should persist in D1.
- Employee requests should succeed for insert/update and fail for delete/publish.
- Multi-file uploads should compute stable order_index from filenames.
- Replaced assets should trigger cache purge and new R2 key persistence.
- Comment submissions should be filtered before persistence.
- Any write/delete should emit an audit_logs record.
