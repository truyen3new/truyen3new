# PM Plan: Cloudflare Comic Platform Delivery

Overview: build the storage model first, then the Worker guardrails, then the delivery path.

Phase 1 — D1 foundation

- Task 1: Create the comic schema migration with roles, users, comics, chapters, pages, comments, and reading_history.
- Task 2: Add foreign keys, indexes, and SQLite triggers for timestamps and chapter cleanup.
- Task 3: Seed the canonical roles: superadmin, admin, employee, user.

Phase 2 — Worker RBAC

- Task 4: Add middleware that resolves identity server-side and maps role to route permissions.
- Task 5: Implement ownership checks for comments and reading history.
- Task 6: Keep delete permissions out of the employee path.

Phase 3 — R2 delivery

- Task 7: Add public CDN paths for free assets.
- Task 8: Add signed URL generation and verification for premium assets.
- Task 9: Make the Worker the only place where R2 access decisions happen.

Phase 4 — Hardening and validation

- Task 10: Add an OWASP access-control checklist and verify deny-by-default behavior.
- Task 11: Test chapter deletes, history updates, and premium asset gating.
- Task 12: Verify the Worker deletes R2 files after DB deletes because SQLite triggers cannot call the R2 API.

Acceptance criteria

- D1 stores only relational data.
- R2 stores only object keys and blobs.
- Worker middleware enforces every role rule.
- Premium assets require signing; free assets remain cacheable.
