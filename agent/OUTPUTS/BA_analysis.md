# BA Analysis: Cloudflare-Native Comic Platform

Date: 2026-05-11
Scope: Cloudflare Workers + D1 + R2

Business Goal

- Keep structured comic data in D1.
- Keep images and covers in R2.
- Keep authorization in the Worker layer.

Primary Risks

- Premium content exposure breaks revenue and trust.
- Treating R2 like a database creates maintenance and audit failures.
- Client-side role checks create privilege escalation and IDOR risk.
- Deleting DB rows without deleting R2 objects leaks storage and content.

Priority Order

1. Ship the D1 schema for users, roles, comics, chapters, pages, comments, and reading history.
2. Enforce RBAC in Worker middleware with server-side ownership checks.
3. Add SQLite triggers for timestamp updates and chapter-driven cleanup.
4. Deliver premium assets with signed URLs and free assets with public CDN paths.

Constraint Set

- R2 stores object keys only, never queryable text.
- RBAC must live in Workers, not in DB triggers or object storage policies.
- Worker code must delete physical R2 objects after DB delete succeeds.
