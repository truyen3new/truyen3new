# TechLead Architecture: Cloudflare Comic Platform

Goal

- Keep structured data in D1.
- Keep blobs in R2.
- Keep authorization in Worker middleware.

Rules

1. D1 is the system of record for users, roles, comics, chapters, pages, comments, and reading history.
2. R2 stores only object keys plus binary images.
3. RBAC runs in Workers, not in triggers or storage policies.
4. SQLite triggers may maintain timestamps and relational cleanup only.
5. The Worker must delete physical R2 objects after a successful DB delete.

Role Model

- superadmin: full CRUD, role administration, R2 lifecycle control.
- admin: comic/chapter metadata, upload/delete assets, moderate comments.
- employee: insert/upload chapters and pages, edit metadata, no deletes.
- user: read-only access plus own comments and reading history.

Delivery Model

- Free assets: public CDN path, aggressive caching.
- Premium assets: short-lived HMAC-signed URL from the Worker.
- Signature validation happens before the object is fetched from R2.

Trigger Model

- `reading_history.updated_at` refreshes on page-turn updates.
- Chapter deletes clear dependent pages and comments.
- Foreign keys still enforce parent-child integrity.

Implementation Artifacts

- `agent/OUTPUTS/Comic_platform_implementation.md` contains the D1 migration and Worker boilerplate.
- `agent/OUTPUTS/Security_hardening.md` contains the release checklist.

Warning

- Do not trust client-supplied role fields.
- Do not encode structured text in R2.
- Do not expect D1 triggers to call the R2 API.
