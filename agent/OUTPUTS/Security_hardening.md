# Security Hardening: CMS Access Control and Audit Matrix

Date: 2026-05-11

## RBAC Matrix

| Endpoint | superadmin | admin | employee | user |
| --- | --- | --- | --- | --- |
| `GET /api/comics` | read | read | read | read |
| `POST /api/comics` | create | create | deny | deny |
| `PATCH /api/comics/:id` | update | update metadata | update metadata only | deny |
| `DELETE /api/comics/:id` | delete | deny | deny | deny |
| `POST /api/comics/:id/chapters` | create | create | create | deny |
| `PATCH /api/chapters/:id` | update | update | update | deny |
| `DELETE /api/chapters/:id` | delete | deny | deny | deny |
| `POST /api/chapters/:id/pages` | create | create | create | deny |
| `PATCH /api/pages/:id` | update | update | update | deny |
| `DELETE /api/pages/:id` | delete | deny | deny | deny |
| `POST /api/comments` | create | create | create | create |
| `PATCH /api/comments/:id` | any comment | any comment | deny | own comment only |
| `DELETE /api/comments/:id` | any comment | any comment | deny | own comment only |
| `GET /api/audit-logs` | read | read | deny | deny |
| `POST /api/uploads/smart` | full | full | chapter/page upload only | deny |
| `POST /api/uploads/purge-cache` | full | full | deny | deny |
| `POST /api/comments/moderate` | full | full | deny | deny |

## Security Rules

- Resolve the actor from a verified token and the D1 `users`/`roles` join.
- Deny by default on every route and promote access only through named permissions.
- Treat `employee` as insert/update only for chapters and pages; no delete or publish operations.
- Record every write and delete into `audit_logs` in the Worker background flow.
- Never trust client-supplied role, owner, premium, or moderation fields.
- Require ownership for user comments, reading history, and draft recovery access.

## Audit and R2 Controls

- Append an audit entry after each mutation with actor, action, target, and field-level change data.
- Purge cache whenever a referenced page or cover object changes.
- Delete physical R2 objects only after the D1 mutation succeeds.
- Keep premium asset URLs short-lived and signed, and do not expose direct object keys to unauthorized users.

## Community Controls

- Run profanity filtering before comment persistence.
- Flag or reject comments based on policy, not client-side suppression alone.
- Use draft recovery for write continuity, but never treat localStorage as authoritative state.

