# PM Plan: CMS Refactor Delivery

Overview: stabilize the content model first, then the upload pipeline, then the security and recovery layers.

Phase 1 — Schema and lifecycle

- Task 1: Extend comics and chapters with lifecycle states, `scheduled_at`, and richer metadata fields.
- Task 2: Add `audit_logs` plus supporting indexes and triggers for timestamps, cleanup, and search.
- Task 3: Introduce a draft buffer table for unsaved content and recovery flows.

Phase 2 — Smart Upload and asset control

- Task 4: Build filename-based bulk upload ordering for chapter pages.
- Task 5: Convert uploads to WebP, compress to the target size, and persist stable R2 keys.
- Task 6: Add a cache purge path for replaced assets so public and premium URLs stay coherent.

Phase 3 — RBAC and moderation

- Task 7: Enforce server-side identity resolution and role-to-endpoint mapping.
- Task 8: Preserve employee write-only content access and block delete/publish operations.
- Task 9: Add profanity filtering and moderation handling for comments.

Phase 4 — Recovery and performance

- Task 10: Implement localStorage draft persistence plus D1-backed draft recovery.
- Task 11: Add full-text and composite indexing for title, tags, and publishing state.
- Task 12: Validate audit logging, upload ordering, cache purge behavior, and permission boundaries.

Acceptance criteria

- Editors can draft, schedule, and publish content without losing state.
- Uploads are deterministic, compressed, and recoverable.
- Every write/delete action generates an audit trail.
- Search and moderation remain usable as record counts grow.
