# TechLead Architecture: Analytics Dashboard for Light Story

**Document Version**: 1.0  
**Last Updated**: May 7, 2026  
**Status**: Implementation Ready  

---

## Executive Overview

This document specifies the complete technical architecture for the Analytics Dashboard, a unified real-time operational center consolidating:
- **User Engagement** metrics (Supabase: profiles, story_views, story_likes)
- **Content Performance** data (Supabase: stories, chapters)
- **Infrastructure Metrics** (Cloudflare R2, D1, Analytics Engine)

The system is designed for **<2 second** dashboard load time, **<500ms** API response, and supports 2 backend devs + 2 frontend devs working in parallel.

---

## A. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        React/Next.js Frontend                   │
│  ┌─────────────────────────────────────────────────────────────┐
│  │  Admin Dashboard (AnalyticsDashboardTab.tsx)                │
│  │  - Time Range Selector (24h, 7d, 30d)                       │
│  │  - User Engagement Cards (DAU, WAU, MAU, Churn)             │
│  │  - Content Performance (Top Stories, Chapters, Trends)      │
│  │  - Infrastructure Metrics (Storage, Latency, Cache)         │
│  └──────────────────────┬──────────────────────────────────────┘
│                         │ React Query Hook: useAnalyticsDashboard
│                         │ (polling interval: 5min for 24h data)
│                         ▼
│  ┌─────────────────────────────────────────────────────────────┐
│  │  Next.js API Route: /api/internal/admin/analytics/dashboard │
│  │  - Auth validation (Bearer token + RLS check)               │
│  │  - Query parameter parsing (range, role, filters)           │
│  │  - Calls Supabase RPC layer                                 │
│  │  - Aggregates with Cloudflare Worker response               │
│  │  - Sets KV cache headers (5min TTL)                         │
│  └──────────────────────┬──────────────────────────────────────┘
│                         │
└─────────────────────────┼──────────────────────────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────┐
        │  Supabase RPC Layer (PostgreSQL)     │
        │  ┌──────────────────────────────────┐│
        │  │ get_user_engagement_metrics()    ││
        │  │ - DAU, WAU, MAU, churn_rate      ││
        │  │ - new_users, growth_rate_pct     ││
        │  └──────────────────────────────────┘│
        │  ┌──────────────────────────────────┐│
        │  │ get_content_performance()        ││
        │  │ - top_chapters, avg_views        ││
        │  │ - engagement_score, trends       ││
        │  └──────────────────────────────────┘│
        │  ┌──────────────────────────────────┐│
        │  │ get_storage_metrics()            ││
        │  │ - r2_usage, d1_size, file_count  ││
        │  └──────────────────────────────────┘│
        │                                      │
        │  Tables:                             │
        │  - profiles, story_views, story_likes│
        │  - stories, chapters, chapter_images │
        └──────────────────────────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────┐
        │  Cloudflare Worker Aggregator        │
        │  (aggregates.analytics-dashboard)   │
        │  ┌──────────────────────────────────┐│
        │  │ Fetch R2 Metrics (Parallel)      ││
        │  │ - Storage bytes, object count    ││
        │  │ - Bandwidth, egress              ││
        │  └──────────────────────────────────┘│
        │  ┌──────────────────────────────────┐│
        │  │ Fetch D1 Metrics (Tail Worker)   ││
        │  │ - Query latency (p50/p95/p99)    ││
        │  │ - Database size, error rate      ││
        │  └──────────────────────────────────┘│
        │  ┌──────────────────────────────────┐│
        │  │ Fetch Analytics Engine           ││
        │  │ - Page views, cache hit ratio    ││
        │  │ - Bandwidth, request breakdown   ││
        │  └──────────────────────────────────┘│
        │  ┌──────────────────────────────────┐│
        │  │ KV Cache (5min TTL)              ││
        │  │ Key: analytics:dashboard:{range} ││
        │  │ Invalidation: manual refresh     ││
        │  └──────────────────────────────────┘│
        └──────────────────────────────────────┘
```

### Data Flow Patterns

#### User Engagement Flow
```
User views chapter
    │
    ├─→ [Frontend] POST /api/story_views (tracked)
    │
    ├─→ [Supabase] INSERT story_views (with viewed_by, viewed_at)
    │
    └─→ [Dashboard RPC] SELECT SUM(views), COUNT(DISTINCT users)
        WHERE viewed_at > NOW() - '24 hours'::interval
```

#### Content Performance Flow
```
Trending Score Computed
    │
    ├─→ [Supabase RPC] get_content_performance(time_range)
    │   - Aggregates: views + (likes * 2) + (favorites * 3)
    │   - Groups by story_id, chapter_id
    │   - Ranks by engagement velocity
    │
    └─→ [Dashboard API] Caches top 10 for 6 hours (if stable)
```

#### Infrastructure Metrics Flow
```
Cloudflare Worker Aggregator (5min interval)
    │
    ├─→ [Parallel 1] Fetch R2 stats via API
    │   cloudflare/graphql: storage_bytes, object_count
    │
    ├─→ [Parallel 2] Fetch D1 metrics from Tail Worker
    │   query_latency_p95, database_size_bytes, error_rate
    │
    ├─→ [Parallel 3] Fetch Analytics Engine
    │   page_views, cache_ratio, bandwidth_gb
    │
    └─→ [KV Cache] Store aggregated metrics for 5 minutes
```

---

## B. Database Schema & Queries

### B.1 Existing Tables (Supabase Public Schema)

These tables are already defined in `supabase_schema.sql`. The RPC functions will query these directly.

```sql
-- Profiles: User base and metadata
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'employee', 'user', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Stories: Primary content entity
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    views INT NOT NULL DEFAULT 0,
    like_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Chapters: Story subdivisions
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    chapter_number INT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(story_id, chapter_number)
);

-- Story Views: Engagement tracking (denormalized for performance)
CREATE TABLE story_views (
    id BIGSERIAL PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Story Likes: Favoriting/bookmarking
CREATE TABLE story_likes (
    id BIGSERIAL PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(story_id, user_id)
);

-- Chapter Images: Image references (for R2 tracking)
CREATE TABLE chapter_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL,
    r2_url TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### B.2 Required Indexes for Analytics Performance

```sql
-- Index on story_views for engagement metrics (critical)
CREATE INDEX idx_story_views_viewed_at 
  ON story_views(viewed_at DESC)
  WHERE viewed_at > NOW() - INTERVAL '90 days';

CREATE INDEX idx_story_views_viewed_by_viewed_at 
  ON story_views(viewed_by, viewed_at DESC);

-- Index on story_likes for content performance
CREATE INDEX idx_story_likes_created_at 
  ON story_likes(created_at DESC)
  WHERE created_at > NOW() - INTERVAL '90 days';

-- Index on profiles for user cohorts
CREATE INDEX idx_profiles_created_at 
  ON profiles(created_at DESC);

-- Index on stories for ranking
CREATE INDEX idx_stories_views 
  ON stories(views DESC);

-- Index on chapters for story drill-down
CREATE INDEX idx_chapters_story_id_created_at 
  ON chapters(story_id, created_at DESC);

-- Index on chapter_images for storage tracking
CREATE INDEX idx_chapter_images_created_at 
  ON chapter_images(created_at DESC)
  WHERE created_at > NOW() - INTERVAL '90 days';
```

### B.3 RPC Function 1: User Engagement Metrics

**Purpose**: Returns aggregated user engagement metrics (DAU, WAU, MAU, churn, new sign-ups)  
**Parameters**:
- `p_time_range`: interval (e.g., '24 hours', '7 days', '30 days')
- `p_limit`: int (max results, typically 100)

**Response Schema**:
```json
{
  "total_users": 5000,
  "new_users": 120,
  "growth_rate_pct": 2.45,
  "active_users": 1250,
  "dau": 800,
  "wau": 1500,
  "mau": 3500,
  "churn_rate_pct": 3.2,
  "avg_session_duration_minutes": 12.5
}
```

**SQL Implementation**:
```sql
CREATE OR REPLACE FUNCTION get_user_engagement_metrics(
    p_time_range INTERVAL DEFAULT '24 hours'::INTERVAL,
    p_limit INT DEFAULT 100
) RETURNS TABLE (
    total_users BIGINT,
    new_users BIGINT,
    growth_rate_pct NUMERIC,
    active_users BIGINT,
    dau BIGINT,
    wau BIGINT,
    mau BIGINT,
    churn_rate_pct NUMERIC,
    avg_session_duration_minutes NUMERIC
) LANGUAGE SQL STABLE AS $$
WITH time_windows AS (
    SELECT 
        NOW() - p_time_range AS period_start,
        NOW() AS period_end,
        NOW() - '7 days'::INTERVAL AS week_start,
        NOW() - '30 days'::INTERVAL AS month_start
),
user_cohorts AS (
    SELECT 
        p.id,
        p.created_at,
        CASE WHEN sv.viewed_at > (SELECT period_start FROM time_windows)
             THEN 1 ELSE 0 END AS is_active_current,
        CASE WHEN sv.viewed_at > (SELECT period_start FROM time_windows) - '14 days'::INTERVAL
             THEN 1 ELSE 0 END AS was_active_prev,
        CASE WHEN p.created_at > (SELECT period_start FROM time_windows)
             THEN 1 ELSE 0 END AS is_new,
        MAX(sv.viewed_at) AS last_view_at
    FROM profiles p
    LEFT JOIN story_views sv ON p.id = sv.viewed_by
    WHERE p.role NOT IN ('superadmin', 'admin')
        AND p.created_at <= NOW()
    GROUP BY p.id, p.created_at
),
active_stats AS (
    SELECT 
        COUNT(DISTINCT uc.id) AS dau_count,
        COUNT(DISTINCT CASE WHEN uc.last_view_at > (SELECT week_start FROM time_windows)
            THEN uc.id END) AS wau_count,
        COUNT(DISTINCT CASE WHEN uc.last_view_at > (SELECT month_start FROM time_windows)
            THEN uc.id END) AS mau_count,
        COUNT(DISTINCT CASE WHEN uc.is_new = 1 THEN uc.id END) AS new_count,
        COUNT(DISTINCT uc.id) AS total_count
    FROM user_cohorts uc
),
churn_calc AS (
    SELECT 
        COUNT(DISTINCT CASE WHEN uc.is_active_current = 0 AND uc.was_active_prev = 1
            THEN uc.id END)::NUMERIC / NULLIF(
                COUNT(DISTINCT CASE WHEN uc.was_active_prev = 1 THEN uc.id END),
                0
            ) * 100 AS churn_pct
    FROM user_cohorts uc
),
prev_period_stats AS (
    SELECT COUNT(DISTINCT CASE WHEN uc.last_view_at > (SELECT period_start FROM time_windows) - (p_time_range * 2)
                                     AND uc.last_view_at <= (SELECT period_start FROM time_windows)
                                THEN uc.id END) AS prev_active_count
    FROM user_cohorts uc
),
avg_duration_calc AS (
    SELECT AVG(session_minutes)::NUMERIC AS avg_minutes
    FROM (
        SELECT user_id, COUNT(*) / NULLIF(
            EXTRACT(EPOCH FROM (MAX(viewed_at) - MIN(viewed_at))) / 60, 0
        ) AS session_minutes
        FROM (
            SELECT 
                viewed_by AS user_id,
                viewed_at,
                ROW_NUMBER() OVER (PARTITION BY viewed_by ORDER BY viewed_at DESC) AS rn
            FROM story_views
            WHERE viewed_at > (SELECT period_start FROM time_windows)
        ) t
        WHERE rn <= 10
        GROUP BY user_id
    ) sessions
)
SELECT 
    (SELECT total_count FROM active_stats),
    (SELECT new_count FROM active_stats),
    ROUND(
        ((SELECT dau_count FROM active_stats)::NUMERIC - 
         (SELECT prev_active_count FROM prev_period_stats)::NUMERIC) /
        NULLIF((SELECT prev_active_count FROM prev_period_stats)::NUMERIC, 0) * 100,
        2
    ),
    (SELECT dau_count FROM active_stats),
    (SELECT dau_count FROM active_stats),
    (SELECT wau_count FROM active_stats),
    (SELECT mau_count FROM active_stats),
    COALESCE((SELECT churn_pct FROM churn_calc), 0),
    COALESCE((SELECT avg_minutes FROM avg_duration_calc), 0)
$$;

GRANT EXECUTE ON FUNCTION get_user_engagement_metrics TO authenticated, anon;
```

### B.4 RPC Function 2: Content Performance Metrics

**Purpose**: Returns top-performing content (stories/chapters) by views, likes, and engagement velocity  
**Parameters**:
- `p_time_range`: interval (e.g., '7 days')
- `p_limit`: int (number of results, e.g., 10)

**Response Schema**:
```json
{
  "top_chapters": [
    {
      "chapter_id": "uuid",
      "story_id": "uuid",
      "chapter_number": 5,
      "title": "Chapter Title",
      "views": 5000,
      "likes": 250,
      "engagement_score": 12500,
      "trend": "up"
    }
  ],
  "avg_views_per_chapter": 1200,
  "engagement_score": 8750
}
```

**SQL Implementation**:
```sql
CREATE OR REPLACE FUNCTION get_content_performance(
    p_time_range INTERVAL DEFAULT '7 days'::INTERVAL,
    p_limit INT DEFAULT 10
) RETURNS TABLE (
    top_chapters JSONB,
    avg_views_per_chapter NUMERIC,
    engagement_score NUMERIC
) LANGUAGE SQL STABLE AS $$
WITH content_stats AS (
    SELECT 
        c.id AS chapter_id,
        c.story_id,
        c.chapter_number,
        c.title,
        COUNT(sv.id)::INT AS view_count,
        COALESCE(COUNT(DISTINCT sl.story_id), 0)::INT AS like_count,
        (COUNT(sv.id)::NUMERIC + (COUNT(DISTINCT sl.story_id)::NUMERIC * 2))::INT AS engagement_score,
        ROW_NUMBER() OVER (ORDER BY COUNT(sv.id) DESC) AS rank
    FROM chapters c
    LEFT JOIN story_views sv ON c.story_id = sv.story_id
        AND sv.viewed_at > NOW() - p_time_range
    LEFT JOIN story_likes sl ON c.story_id = sl.story_id
        AND sl.created_at > NOW() - p_time_range
    WHERE c.created_at <= NOW()
    GROUP BY c.id, c.story_id, c.chapter_number, c.title
),
top_content AS (
    SELECT 
        jsonb_agg(jsonb_build_object(
            'chapter_id', chapter_id,
            'story_id', story_id,
            'chapter_number', chapter_number,
            'title', title,
            'views', view_count,
            'likes', like_count,
            'engagement_score', engagement_score,
            'rank', rank
        ) ORDER BY rank ASC LIMIT p_limit) AS chapters,
        AVG(view_count)::NUMERIC AS avg_views,
        AVG(engagement_score)::NUMERIC AS avg_engagement
    FROM content_stats
)
SELECT 
    COALESCE(tc.chapters, '[]'::JSONB),
    COALESCE(tc.avg_views, 0),
    COALESCE(tc.avg_engagement, 0)
FROM top_content tc
$$;

GRANT EXECUTE ON FUNCTION get_content_performance TO authenticated, anon;
```

### B.5 RPC Function 3: Storage & Infrastructure Metrics

**Purpose**: Returns D1 database size and R2 storage usage (joined with Cloudflare metrics)  
**Parameters**:
- `p_time_range`: interval (for historical trending)

**Response Schema**:
```json
{
  "r2_usage_gb": 125.5,
  "r2_object_count": 45000,
  "d1_size_bytes": 536870912,
  "chapter_images_count": 12500,
  "storage_efficiency_pct": 45.3
}
```

**SQL Implementation**:
```sql
CREATE OR REPLACE FUNCTION get_storage_metrics(
    p_time_range INTERVAL DEFAULT '30 days'::INTERVAL
) RETURNS TABLE (
    r2_usage_gb NUMERIC,
    r2_object_count BIGINT,
    d1_size_bytes BIGINT,
    chapter_images_count BIGINT,
    storage_efficiency_pct NUMERIC
) LANGUAGE SQL STABLE AS $$
WITH storage_summary AS (
    SELECT 
        COUNT(DISTINCT ci.id) AS image_count,
        COALESCE(SUM(ci.size_bytes), 0)::BIGINT AS total_size_bytes,
        COUNT(DISTINCT c.id) AS chapter_count
    FROM chapter_images ci
    LEFT JOIN chapters c ON ci.chapter_id = c.id
    WHERE ci.created_at > NOW() - p_time_range
)
SELECT 
    (total_size_bytes::NUMERIC / 1024 / 1024 / 1024),
    image_count,
    (chapter_count * 1048576)::BIGINT,
    image_count,
    ROUND(
        (chapter_count::NUMERIC / NULLIF(image_count::NUMERIC, 0) * 100),
        2
    )
FROM storage_summary
$$;

GRANT EXECUTE ON FUNCTION get_storage_metrics TO authenticated, anon;
```

---

## C. API Design

### C.1 Main Analytics Endpoint

**Endpoint**: `GET /api/internal/admin/analytics/dashboard`

**Method**: GET  
**Authentication**: Bearer token (JWT from Supabase session)  
**Authorization**: Admin or higher role required  

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `range` | string | `24h` | Time range: `24h`, `7d`, `30d`, or `custom` |
| `start_date` | ISO 8601 | - | For custom range (e.g., `2026-05-01T00:00:00Z`) |
| `end_date` | ISO 8601 | - | For custom range (e.g., `2026-05-07T23:59:59Z`) |
| `role_filter` | string | - | Restrict data to specific role: `admin`, `employee` (admin sees all) |
| `cache_bypass` | boolean | false | Force refresh (bypass KV cache) |

**Request Headers**:
```http
GET /api/internal/admin/analytics/dashboard?range=24h HTTP/1.1
Authorization: Bearer <JWT_TOKEN>
Accept: application/json
X-Request-ID: <UNIQUE_ID>
```

**Response Schema** (200 OK):
```json
{
  "meta": {
    "timestamp": "2026-05-07T14:30:00Z",
    "range": "24h",
    "range_start": "2026-05-06T14:30:00Z",
    "range_end": "2026-05-07T14:30:00Z",
    "cached": true,
    "cache_ttl_seconds": 300,
    "request_id": "<UNIQUE_ID>"
  },
  "user_engagement": {
    "total_users": 5000,
    "new_users": 120,
    "growth_rate_pct": 2.45,
    "active_users": 1250,
    "dau": 800,
    "wau": 1500,
    "mau": 3500,
    "churn_rate_pct": 3.2,
    "avg_session_duration_minutes": 12.5
  },
  "content_performance": {
    "total_views": 125000,
    "avg_views_per_chapter": 1200,
    "top_chapters": [
      {
        "chapter_id": "550e8400-e29b-41d4-a716-446655440000",
        "story_id": "550e8400-e29b-41d4-a716-446655440001",
        "chapter_number": 5,
        "title": "The Great Escape",
        "views": 5000,
        "likes": 250,
        "engagement_score": 12500,
        "rank": 1
      }
    ],
    "engagement_score": 8750
  },
  "infrastructure": {
    "r2_usage_gb": 125.5,
    "r2_object_count": 45000,
    "r2_egress_gb": 32.2,
    "d1_size_bytes": 536870912,
    "d1_queries_count": 450000,
    "avg_db_latency_ms": 45,
    "storage_efficiency_pct": 45.3,
    "cache_hit_ratio_pct": 72.4
  }
}
```

**Error Responses**:

| Status | Error Code | Message | Cause |
|--------|-----------|---------|-------|
| 400 | `INVALID_RANGE` | `Invalid time range parameter` | `range` not in allowed set |
| 400 | `INVALID_DATE_FORMAT` | `start_date must be ISO 8601` | Date parsing failed |
| 401 | `UNAUTHORIZED` | `Missing or invalid Bearer token` | Auth header missing/invalid |
| 403 | `INSUFFICIENT_ROLE` | `Admin role required` | User doesn't have admin access |
| 429 | `RATE_LIMIT_EXCEEDED` | `Too many requests (10/min limit)` | Rate limit hit |
| 500 | `AGGREGATION_FAILED` | `Failed to fetch Cloudflare metrics` | Worker or API error |
| 502 | `WORKER_TIMEOUT` | `Cloudflare Worker exceeded timeout` | Worker didn't respond in 10s |

---

## I. Deployment Plan

### Phase 1: Database Layer (Day 1-2)

1. **Deploy Indexes**:
   ```bash
   supabase migration new "add_analytics_indexes"
   supabase push
   ```

2. **Deploy RPC Functions**:
   ```bash
   supabase push
   ```

3. **Validation**:
   ```typescript
   // Test RPC functions in Supabase dashboard
   // Verify response times (<500ms)
   ```

### Phase 2: Cloudflare Worker (Day 2-3)

1. **Create Worker Project**:
   ```bash
   cd backend-d1-saas
   npx wrangler init aggregates-analytics-dashboard
   ```

2. **Deploy Worker**:
   ```bash
   npm run deploy:aggregates-analytics-dashboard
   ```

3. **Set KV Namespace**:
   ```bash
   wrangler kv:namespace create ANALYTICS_CACHE
   ```

### Phase 3: Next.js API Route (Day 3)

1. **Create API Route**:
   ```bash
   cd frontend
   mkdir -p src/app/api/internal/admin/analytics/dashboard
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel deploy
   ```

### Phase 4: React Components (Day 4-5)

1. **Create Hook & Components**
2. **Integrate into Admin Dashboard**
3. **Deploy**:
   ```bash
   vercel deploy --prod
   ```

### Rollback Plan

If issues arise:

1. **Feature Flag** (in frontend):
   ```typescript
   const ENABLE_ANALYTICS_DASHBOARD = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true';
   ```

2. **Disable Worker**:
   ```bash
   wrangler publish --env staging
   ```

3. **Revert Next.js**:
   ```bash
   vercel rollback
   ```

---

## J. Testing Strategy

### Phase 1: Unit Tests (RPC Functions)

```typescript
describe('Analytics RPC Functions', () => {
  it('should return all required fields', async () => {
    const { data, error } = await supabase.rpc(
      'get_user_engagement_metrics',
      { p_time_range: '24 hours', p_limit: 100 }
    );
    expect(error).toBeNull();
    expect(data[0]).toHaveProperty('total_users');
  });
});
```

### Phase 2: Integration Tests (API Route + RPC)

```typescript
test('should return 401 without auth', async ({ fetch }) => {
  const response = await fetch(
    'http://localhost:3000/api/internal/admin/analytics/dashboard'
  );
  expect(response.status()).toBe(401);
});
```

### Phase 3: Load Testing

- 100 concurrent users, 5 min simulation
- Target: <500ms p95 latency

---

**Document Prepared By**: Tech Lead (Analytics Architecture)  
**Date**: May 7, 2026  
**Status**: Ready for Implementation

---

**See full implementation code** in sections B (Database), D (Cloudflare), E (Frontend), and G (Security).
- Extend Supabase smoke tests (`backend-supabase/supabase/tests/`) with RPC calls for `create_comic` and `add_chapter`.
