# Security Hardening Checklist: Comic Platform

Date: 2026-05-11

Use this checklist before release. If any item is false, the design is not production-safe.

## Access Control

- [ ] Deny by default on every Worker route.
- [ ] Resolve role server-side from verified identity and D1 `users`/`roles` tables.
- [ ] Reject any request that tries to set or override role in the payload.
- [ ] Enforce ownership for comment edits, comment deletes, and reading-history writes.
- [ ] Keep `employee` delete-free by policy, not by convention.
- [ ] Allow `admin` to moderate comments and manage content metadata only.
- [ ] Reserve `superadmin` for platform rescue, role management, and full CRUD.

## Data Boundaries

- [ ] D1 stores metadata, relationships, and user state only.
- [ ] R2 stores only blobs plus D1 keys, never structured content.
- [ ] No structured text, comments, or history records live in R2.
- [ ] No database trigger attempts to call an external storage API.

## R2 Delivery

- [ ] Free assets use public CDN paths with cache-friendly headers.
- [ ] Premium assets require HMAC-signed URLs with short expiry.
- [ ] The Worker checks signature, expiry, and role before object access.
- [ ] The Worker sets `private` cache control for premium objects.
- [ ] The Worker deletes physical R2 objects after a successful DB delete.

## Database Safety

- [ ] `reading_history.updated_at` refreshes on page-turn updates.
- [ ] Chapter deletes remove dependent pages and comments.
- [ ] Foreign keys are present for every parent-child relationship.
- [ ] Role values are constrained to the canonical four names.

## OWASP Access-Control Controls

- [ ] Every endpoint has an explicit authorization rule.
- [ ] Sensitive routes are never reachable from unauthenticated traffic.
- [ ] There is no direct object reference without an ownership check.
- [ ] There is no client-side trust for role, premium status, or ownership.
- [ ] Privilege escalation paths are covered by tests.
- [ ] Audit logs capture admin changes, deletes, and R2 access anomalies.

## Operational Hardening

- [ ] Rate limiting exists on auth, admin, and asset-serve routes.
- [ ] Secret material is server-side only.
- [ ] Errors returned to clients are generic.
- [ ] Security headers are enabled at the edge.
- [ ] Workers and D1 migrations are tested in staging before production.

