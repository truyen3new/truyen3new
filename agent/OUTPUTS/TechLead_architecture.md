# TechLead Architecture: Enterprise Comic Management System

Goal

- Convert the current comic creation surface into a CMS with explicit lifecycle, auditability, and safe asset orchestration.
- Keep D1 as the system of record, R2 as the binary store, Workers as the policy and execution plane, and the frontend as a draft-friendly UI shell.

Architecture Boundaries

1. D1 owns comics, chapters, pages, comments, reading history, drafts, and audit logs.
2. R2 stores only images and object keys; it never stores lifecycle state or rich metadata.
3. Workers resolve identity, authorize actions, transform uploads, purge cache, and append audit records.
4. The frontend uses localStorage for immediate draft recovery and D1 for durable draft buffering.
5. SQLite triggers are limited to timestamp maintenance, relational cleanup, and indexing support.

Lifecycle Model

- Comics and chapters support `draft`, `pending`, `published`, and `archived` states.
- `scheduled_at` enables future publishing without overloading the editor UI.
- `rank_score` supports editorial ordering and recommendation workflows.
- `genres`, `tags`, `artist`, `translator`, and `source` enrich discoverability and attribution.

Operational Model

- Smart Upload receives a file batch, extracts order from filenames, normalizes images to WebP, and stores the resulting objects in R2.
- Cache purges are initiated from the Worker whenever a referenced object is replaced.
- Audit logging is asynchronous from the caller perspective but must be recorded for every write and delete path.
- Profanity filtering runs before comment persistence so moderation decisions are centralized and repeatable.

Indexing Model

- Use composite indexes for status, scheduling, comic ownership, and chapter ordering.
- Use FTS on title and tags to keep catalog search responsive at scale.
- Prefer JSON text columns for tags and genres only when normalized rows are unnecessary.

Key Risks

- Never let client-provided role values drive authorization.
- Never rely on D1 triggers to call R2 or Cloudflare APIs.
- Never allow delete paths to skip audit logging or cache invalidation.
