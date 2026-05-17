# Live Database Audit Procedures

## Overview
Document procedures for programmatically auditing live Supabase, Cloudflare D1, and R2 data integrity. These are **manual validation procedures** that should be executed post-deployment.

---

## Prerequisites

### Environment Variables Required
```bash
export SUPABASE_PROJECT_ID="your_project_id"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
export D1_DATABASE_ID="your_d1_database_id"
export CLOUDFLARE_ACCOUNT_ID="your_account_id"
export CLOUDFLARE_API_TOKEN="your_api_token"
export R2_BUCKET_COVERS="your_covers_bucket"
export R2_BUCKET_CHAPTERS="your_chapters_bucket"
```

### Tools Required
- `curl` (HTTP client)
- `jq` (JSON processor)
- `wrangler` (Cloudflare CLI)
- `psql` (PostgreSQL client, optional for Supabase direct connections)

---

## Part 1: Supabase Schema Audit

### 1.1 Verify Table Existence

```bash
# Connect to Supabase PostgreSQL directly (if VPC access enabled)
SUPABASE_PSQL_URL="postgresql://postgres:[SERVICE_ROLE_KEY]@db.[PROJECT_ID].supabase.co:5432/postgres"

psql "$SUPABASE_PSQL_URL" -c "\dt public.*"
```

**Expected tables:**
- `public.profiles` – User profiles and roles
- `public.comics` – Comic metadata
- `public.chapters` – Chapter content
- `public.stories` – Story entries
- `public.reading_progress` – User progress tracking
- `public.analytics_events` – Event audit log

### 1.2 Validate RLS Policies

```bash
# List all RLS policies
psql "$SUPABASE_PSQL_URL" -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
```

**Critical policies to verify:**
- `read_published_comics` – Anonymous can read published comics only
- `read_free_chapters` – Anonymous can read free chapters
- `read_vip_chapters_premium_admin` – Premium users and admins can read VIP chapters
- `update_own_reading_progress` – Users can only update their own progress

### 1.3 Check Indexes for Query Performance

```bash
psql "$SUPABASE_PSQL_URL" -c "SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;"
```

**Critical indexes to verify:**
- `chapters.comic_id` – Foreign key index for chapter lookups
- `reading_progress.(user_id, story_id)` – Composite for user progress queries
- `analytics_events.(timestamp, event_type)` – Time-series queries

### 1.4 Data Integrity Checks

```bash
# Check for orphaned chapters (chapters without valid comic)
psql "$SUPABASE_PSQL_URL" << EOF
SELECT 
  c.id as chapter_id,
  c.comic_id,
  COUNT(*) as issue_count
FROM public.chapters c
LEFT JOIN public.comics co ON c.comic_id = co.id
WHERE co.id IS NULL
GROUP BY c.id, c.comic_id;
EOF
```

**Action if orphaned chapters found:**
- Log to audit table
- Recommend: Soft-delete orphaned chapters (set `deleted_at = NOW()`)
- Mark parent comic for review

```bash
# Check for invalid user references in reading_progress
psql "$SUPABASE_PSQL_URL" << EOF
SELECT 
  rp.id,
  rp.user_id,
  COUNT(*) as issue_count
FROM public.reading_progress rp
LEFT JOIN public.profiles p ON rp.user_id = p.id
WHERE p.id IS NULL
GROUP BY rp.id, rp.user_id;
EOF
```

---

## Part 2: Cloudflare D1 Schema & Data Audit

### 2.1 Query D1 Schema

```bash
# List all tables in D1
npx wrangler d1 execute $D1_DATABASE_ID --remote \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

**Expected tables:**
- `comics_metadata` – Synced from Supabase
- `chapters_metadata` – Chapter pointers to R2 objects
- `user_sessions` – Cloudflare-side session cache

### 2.2 Validate D1 Schema Matches Supabase

```bash
# Export D1 schema
npx wrangler d1 execute $D1_DATABASE_ID --remote ".schema" > d1_schema.sql

# Compare column counts and types with Supabase
# (Manual comparison needed; no automated cross-DB tools in this context)
```

### 2.3 Check Data Sync Timestamp

```bash
# Verify last sync timestamp
npx wrangler d1 execute $D1_DATABASE_ID --remote \
  "SELECT name, last_synced_at FROM metadata WHERE entity_type='sync_status';"
```

**Alert if:**
- `last_synced_at` is older than 24 hours
- Sync status shows errors

---

## Part 3: R2 Storage Audit

### 3.1 Verify R2 Bucket Exists and is Accessible

```bash
# List objects in R2 covers bucket
curl -X GET "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/$R2_BUCKET_COVERS" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.'
```

### 3.2 Count Objects and Check Size

```bash
# Get bucket statistics via Cloudflare API
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq ".result[] | select(.name==\"$R2_BUCKET_COVERS\") | {name, creation_date, size: .object_count}"
```

### 3.3 Verify All DB References Point to Valid R2 Objects

```bash
# Export comic cover URLs from D1
COVER_URLS=$(npx wrangler d1 execute $D1_DATABASE_ID --remote \
  "SELECT cover_url FROM comics_metadata WHERE cover_url IS NOT NULL;")

# For each URL, verify object exists in R2
echo "$COVER_URLS" | while read url; do
  OBJECT_KEY=$(echo "$url" | sed 's|.*/||')  # Extract key from URL
  
  # HEAD request to check existence
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://$R2_BUCKET_COVERS.r2.cloudflarestorage.com/$OBJECT_KEY")
  
  if [ "$HTTP_CODE" != "200" ]; then
    echo "ORPHANED: $url (HTTP $HTTP_CODE)"
  fi
done
```

### 3.4 Check for Orphaned Objects (DB Records Missing)

```bash
# List all objects in R2
LIVE_OBJECTS=$(curl -s -X GET "https://$R2_BUCKET_COVERS.r2.cloudflarestorage.com/?list-type=2" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | grep -oP 'Key>\K[^<]+' || true)

# Get all referenced objects from D1
DB_OBJECTS=$(npx wrangler d1 execute $D1_DATABASE_ID --remote \
  "SELECT cover_url FROM comics_metadata WHERE cover_url IS NOT NULL;" | \
  sed 's|.*/||')

# Find orphans
echo "$LIVE_OBJECTS" | while read obj; do
  if ! echo "$DB_OBJECTS" | grep -q "$obj"; then
    echo "ORPHANED_OBJECT: $obj (not referenced in D1)"
  fi
done
```

---

## Part 4: Cross-Database Alignment Check

### 4.1 Verify Data Consistency

**Supabase → D1 Sync Check:**
```bash
# Count comics in Supabase
SUPABASE_COMICS=$(psql "$SUPABASE_PSQL_URL" -t -c "SELECT COUNT(*) FROM public.comics;")

# Count comics in D1
D1_COMICS=$(npx wrangler d1 execute $D1_DATABASE_ID --remote "SELECT COUNT(*) FROM comics_metadata;")

if [ "$SUPABASE_COMICS" != "$D1_COMICS" ]; then
  echo "⚠️  DATA MISMATCH: Supabase has $SUPABASE_COMICS comics, D1 has $D1_COMICS"
fi
```

**D1 → R2 Coverage Check:**
```bash
# Count chapter entries in D1
D1_CHAPTERS=$(npx wrangler d1 execute $D1_DATABASE_ID --remote "SELECT COUNT(*) FROM chapters_metadata WHERE r2_object_key IS NOT NULL;")

# Count objects in R2 chapters bucket
R2_CHAPTERS=$(curl -s -X GET "https://$R2_BUCKET_CHAPTERS.r2.cloudflarestorage.com/?list-type=2" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | grep -c "Key" || echo "0")

echo "D1 chapters with R2 references: $D1_CHAPTERS"
echo "R2 chapter objects present: $R2_CHAPTERS"
```

### 4.2 Generate Alignment Report

```bash
# Sample audit report generation
cat > AUDIT_ALIGNMENT_REPORT.md << 'EOF'
# Database Alignment Audit Report

**Generated**: $(date)
**Environment**: Production

## Summary

| System | Records | Status |
|--------|---------|--------|
| Supabase (comics) | [COUNT] | ✓ Active |
| D1 (synced) | [COUNT] | ✓ Synced |
| R2 (covers) | [COUNT] | ✓ Available |
| R2 (chapters) | [COUNT] | ✓ Available |

## Issues Found

- [Orphaned chapters]: 0
- [Invalid user references]: 0
- [Missing R2 objects]: 0
- [Orphaned R2 files]: 0

## Recommendations

1. Schedule weekly sync verification
2. Implement automatic cleanup for orphaned records (30-day grace period)
3. Monitor D1 ↔ Supabase replication lag

EOF
cat AUDIT_ALIGNMENT_REPORT.md
```

---

## Part 5: Automated Health Check (Optional)

Create a scheduled worker to periodically verify data integrity:

```typescript
// workers/database-health-check/src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(auditDatabases(env));
  },
};

async function auditDatabases(env: Env) {
  // Query D1 for recent sync errors
  const result = await env.DB.prepare(
    "SELECT COUNT(*) as error_count FROM audit_log WHERE level='ERROR' AND created_at > datetime('now', '-1 hour')"
  ).first();

  // Alert if errors found
  if (result?.error_count > 0) {
    await notifySlack(env, `Database audit found ${result.error_count} errors in last hour`);
  }
}
```

Deploy with wrangler:
```bash
npx wrangler deploy --config workers/database-health-check/wrangler.jsonc
```

---

## Execution Checklist

- [ ] Set all environment variables
- [ ] Verify connectivity to Supabase, D1, R2
- [ ] Run Part 1: Supabase schema audit
- [ ] Run Part 2: D1 schema validation
- [ ] Run Part 3: R2 storage audit
- [ ] Run Part 4: Cross-database alignment
- [ ] Review audit log for issues
- [ ] Create issues for any orphaned data
- [ ] Document findings in AUDIT_ALIGNMENT_REPORT.md
- [ ] Schedule next audit (recommend: weekly)

---

## Issue Remediation

### For Orphaned Chapters
```bash
# Soft-delete orphaned chapters (prefer soft-delete for audit trail)
psql "$SUPABASE_PSQL_URL" << EOF
UPDATE public.chapters
SET deleted_at = NOW()
WHERE comic_id NOT IN (SELECT id FROM public.comics)
  AND deleted_at IS NULL;
EOF
```

### For Orphaned R2 Objects
```bash
# Delete orphaned objects from R2 (requires admin access)
# Example: delete object by key
curl -X DELETE "https://$R2_BUCKET_COVERS.r2.cloudflarestorage.com/orphaned-object-key" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot connect to Supabase | Verify `SUPABASE_SERVICE_ROLE_KEY` is valid and not expired |
| wrangler command not found | Install: `npm install -g wrangler` |
| R2 API returns 403 | Check `CLOUDFLARE_API_TOKEN` has R2 permissions |
| D1 query timeout | Database may be large; add LIMIT or index missing columns |

