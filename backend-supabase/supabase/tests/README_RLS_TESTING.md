# RLS & Authorization Testing Guide

## Overview

Testing guide for Row Level Security (RLS) policies and authorization logic across all user roles: anonymous, user, premium, admin, and superadmin.

## 1. SQL-Based RLS Validation

Run these queries in Supabase Dashboard → SQL Editor to validate RLS helpers and policies.

### Helper Function Tests

```sql
-- is_superadmin() test
SELECT public.is_superadmin('actual-user-uuid');  -- true for superadmin users

-- is_admin_or_higher() test
SELECT public.is_admin_or_higher('actual-user-uuid');  -- true for admin/superadmin

-- is_premium_or_higher() test
SELECT public.is_premium_or_higher('actual-user-uuid');  -- true for premium+
```

### Policy Tests (anonymous/public)

```sql
-- Published stories should be readable
SELECT * FROM public.stories WHERE status = 'published';
-- Expected: rows returned

-- Draft stories should be empty for anonymous
SELECT * FROM public.stories WHERE status = 'draft';
-- Expected: empty (unless you are staff)

-- Free chapters readable
SELECT * FROM public.chapters WHERE vip_content = false LIMIT 5;
-- Expected: rows returned

-- VIP chapters empty for anonymous
SELECT * FROM public.chapters WHERE vip_content = true LIMIT 5;
-- Expected: empty
```

## 2. Role Hierarchy & Permissions

```
superadmin (highest)
  ├─ admin
  │   ├─ employee
  │   │   └─ premium
  │   │       └─ user
  │   │           └─ anonymous (lowest)
```

| Role | Free Chapters | VIP Chapters | Comments | Settings | Admin Panels |
|---|---|---|---|---|---|
| anonymous | ✅ | ❌ | ❌ | ❌ | ❌ |
| user | ✅ | ❌ | ✅ (own) | ❌ | ❌ |
| premium | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| employee | ✅ | ✅ | ✅ (own) | ❌ | Limited |
| admin | ✅ | ✅ | ✅ (all) | ✅ | ✅ |
| superadmin | ✅ | ✅ | ✅ (all) | ✅ | ✅ (full bypass) |

## 3. API Gateway Auth Tests

Via the API Gateway (see `API_test.md` for full Postman test cases):

```bash
# No auth → 401
curl -s -o /dev/null -w "%{http_code}" https://gateway/api/v1/comics
# → 401

# Invalid JWT → 401
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid" https://gateway/api/v1/comics
# → 401

# Valid JWT, insufficient role → 403
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <user-jwt>" https://gateway/api/v1/comics
# → 403

# Valid JWT, correct role → 200
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <admin-jwt>" https://gateway/api/v1/comics
# → 200
```

## 4. Server-Side Auth (routeAuth.ts)

The `isAllowedRouteRole()` function in `frontend/src/lib/routeAuth.ts` handles role checks:

- Superadmin: bypass all role checks (returns `true` unconditionally)
- All other roles: checked against `allowedRoles` array
- Supports Bearer JWT, cookie sessions, and `x-internal-secret`

## 5. R2 Proxy Auth Tests

```bash
# Public asset → 200
curl -I https://assets.worker.dev/public/test.txt

# VIP asset no auth → 403
curl -I https://assets.worker.dev/vip/premium.txt

# VIP asset + premium JWT → 200
curl -I -H "Authorization: Bearer <premium-jwt>" https://assets.worker.dev/vip/premium.txt

# VIP asset + user JWT → 403
curl -I -H "Authorization: Bearer <user-jwt>" https://assets.worker.dev/vip/premium.txt

# Expired HMAC signed URL → 401
curl -I "https://assets.worker.dev/vip/premium.txt?sig=hmac.0"
```

## 6. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| RLS policy violation | Migration not applied | Run `supabase db push` |
| Helper function not found | Missing migration | Apply `202605110002_add_superadmin_helpers.sql` |
| Token invalid/expired | Auth session expired | Refresh Supabase JWT |
| Gateway 401 on valid JWT | JWKS URL misconfigured | Check `SUPABASE_JWKS_URL` secret |
| Superadmin can't access | routeAuth.ts short-circuit missing | Verify `isAllowedRouteRole('superadmin', [...])` returns true |

## Migration Checklist

- [ ] `20260421074259_admin_operations_schema.sql` (core admin tables + RLS)
- [ ] `20260422025437_admin_user_audit_logs.sql` (audit logs RLS)
- [ ] `202605100001_comic_platform.sql` (comic platform + VIP gating)
- [ ] `202605110001_security_hardening_comments_ratings.sql` (comments/ratings RLS)
- [ ] `202605110002_add_superadmin_helpers.sql` (superadmin fast-path)
- [ ] Superadmin bypass in `frontend/src/lib/routeAuth.ts`
- [ ] Gateway JWT validation configured with `SUPABASE_JWKS_URL`
