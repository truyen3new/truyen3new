# BA Analysis: Analytics Overview Dashboard for Light Story

## Executive Summary

The Analytics Overview Dashboard consolidates user engagement metrics (from Supabase), content performance data, and infrastructure metrics (from Cloudflare) into a unified, real-time operational center. Target users are platform admins, ops teams, and content managers who need to make data-driven decisions on user retention, content strategy, and infrastructure optimization.

---

## 1. Business Objectives

### Primary Goals

1. **Improve User Retention**: Identify churn patterns and engagement drop-offs
   - Track daily/weekly active users (DAU/WAU/MAU)
   - Monitor new sign-up trends and conversion funnels
   - Detect inactive user cohorts for re-engagement campaigns

2. **Optimize Content Strategy**: Understand what content resonates
   - Identify top-performing chapters/stories by read count and engagement
   - Track reader progression (completion rates per chapter)
   - Highlight trending content for promotion

3. **Monitor Infrastructure Health**: Ensure scalability and cost-effectiveness
   - Track storage usage growth (R2 image buckets)
   - Monitor database query performance (D1 query latency, execution patterns)
   - Measure bandwidth utilization and CDN cache hit rates

4. **Support Business Intelligence**: Enable strategic planning
   - Monthly/quarterly trend analysis for board reports
   - Revenue impact of content and infrastructure decisions
   - Competitive benchmarking (e.g., avg readers per chapter vs. competitors)

### Key Performance Indicators (KPIs)

#### User Engagement KPIs
| KPI | Definition | Target | Refresh |
|-----|-----------|--------|---------|
| **Daily Active Users (DAU)** | Unique users who viewed ≥1 chapter today | +10% MoM | 1h |
| **Weekly Active Users (WAU)** | Unique users active in last 7 days | +5% WoW | 6h |
| **Monthly Active Users (MAU)** | Unique users active in last 30 days | +3% MoM | 24h |
| **New Sign-ups (Daily/Weekly)** | New profiles created | 100+/day | 1h |
| **Churn Rate** | Users inactive for 14+ days | <5% | Daily |
| **Avg. Session Duration** | Minutes spent reading per session | >10 min | 1h |
| **Favorite/Bookmark Rate** | Avg favorites per active user | >2/user | 6h |

#### Content Performance KPIs
| KPI | Definition | Target | Refresh |
|-----|-----------|--------|---------|
| **Top 10 Stories by Views** | Most-read stories, ranked | Updated daily | 6h |
| **Top 10 Chapters by Reads** | Most-read chapters, ranked | Updated daily | 6h |
| **Chapter Completion Rate** | (Readers who finish ch. X / Readers who started) * 100% | >80% | 6h |
| **Story Completion Rate** | (Completed last chapter / Started story) * 100% | >50% | 24h |
| **Trending Score** | Engagement velocity (views + likes + favorites in last 7d) | Real-time | 1h |
| **Avg. Reads per Chapter** | Total chapter views / # chapters | >500/ch | 24h |

#### Infrastructure KPIs
| KPI | Definition | Target | Refresh |
|-----|-----------|--------|---------|
| **R2 Storage Used** | Total bytes in cover + chapter buckets | <$100/mo | 24h |
| **R2 Request Quota** | Calls to R2 API vs. plan limit | <80% | 6h |
| **D1 Query Latency (p95)** | 95th percentile query execution time | <100ms | 1h |
| **D1 Storage Used** | Database size across all tenants | Monitor | 24h |
| **Cloudflare Bandwidth (GB)** | Monthly data transfer | Monitor | 6h |
| **Cache Hit Ratio** | (Cached responses / Total responses) * 100% | >70% | 6h |

### Dashboard User Personas

#### 1. **Platform Admin (Superadmin)**
- **Goals**: See full platform health, make resource allocation decisions
- **Access**: All metrics, all time ranges, export data
- **Needs**: Trending stories, user retention cohorts, infrastructure costs
- **Frequency**: 3-5x per week
- **Tools**: PDF exports, filtered reports, user management from dashboard

#### 2. **Operations Manager**
- **Goals**: Monitor infrastructure and alert on anomalies
- **Access**: Infrastructure KPIs, bandwidth, storage, query performance
- **Needs**: Real-time dashboards, anomaly alerts, capacity planning reports
- **Frequency**: Daily during business hours
- **Tools**: Alerts, thresholds, trending graphs, SLA compliance view

#### 3. **Content Manager**
- **Goals**: Understand reader engagement, optimize content strategy
- **Access**: Story/chapter performance, trending topics, reader feedback
- **Needs**: Top/bottom performers, engagement trends, audience demographics
- **Frequency**: 2-3x per week
- **Tools**: Filtered views (by category/author), reader engagement breakdown, leaderboards

#### 4. **Analytics / Business Intelligence Team**
- **Goals**: Generate insights for exec reports and data-driven strategy
- **Access**: All data, historical trends, custom date ranges
- **Needs**: Cohort analysis, retention curves, revenue correlation
- **Frequency**: Weekly/monthly
- **Tools**: Custom queries, export API, trend forecasting, comparison views

---

## 2. Data Requirements Breakdown

### 2.1 Supabase Data Sources

#### User Engagement Layer
| Table | Fields | Purpose | Query Pattern | Frequency |
|-------|--------|---------|--------------|-----------|
| `profiles` | id, email, role, created_at | User base, sign-ups | `SELECT COUNT(*) FROM profiles WHERE created_at > ?` | Hourly |
| `story_views` | id, story_id, viewed_by, viewed_at | View tracking (unique per user/hour) | `SELECT COUNT(DISTINCT viewed_by), COUNT(*) FROM story_views WHERE viewed_at > ?` | Hourly |
| `story_likes` | story_id, user_id, created_at | Favorite activity | `SELECT COUNT(*) FROM story_likes GROUP BY story_id ORDER BY COUNT DESC` | 6-hourly |
| `stories` | id, title, views, like_count, created_at | Story metadata + aggregates | `SELECT * FROM stories ORDER BY views DESC LIMIT 10` | 6-hourly |
| `chapters` | id, story_id, chapter_number, created_at | Chapter catalog | `SELECT COUNT(*) FROM chapters GROUP BY story_id` | Daily |

#### Multi-tenant Layer (Cloudflare D1)
| Table | Fields | Purpose | Query Pattern | Frequency |
|-------|--------|---------|--------------|-----------|
| `stories` (tenant DB) | id, title, view_count, created_at | Tenant-specific stories | `SELECT * FROM stories ORDER BY view_count DESC` | 6-hourly |
| `chapters` (tenant DB) | id, story_id, content, created_at | Tenant-specific chapters | `SELECT COUNT(*) FROM chapters` | Daily |

#### Supplementary Data
| Table | Fields | Purpose | Notes |
|-------|--------|---------|-------|
| `profiles` (cohort) | id, created_at, role | Cohort analysis | Group sign-ups by week/month for retention curves |
| Dashboard Access Logs | user_id, accessed_at | Dashboard usage tracking | Understand who uses analytics, when, how often |

### 2.2 Cloudflare API Data Sources

#### R2 (Object Storage)
| Metric | Source | Query Method | Frequency | Notes |
|--------|--------|--------------|-----------|-------|
| **Storage Used (bytes)** | R2 API | `GET /accounts/{id}/storage/buckets` | 24-hourly | Separate buckets: covers, chapters |
| **Object Count** | R2 API | `GET /accounts/{id}/storage/buckets/{name}/objects?prefix=` | 24-hourly | Track growth of image library |
| **Request Count** | R2 API Metrics | `GET /accounts/{id}/storage/analytics/requests` | 6-hourly | Requests to R2 API (list, upload, delete) |
| **Bandwidth (bytes)** | R2 API Metrics | `GET /accounts/{id}/storage/analytics/bandwidth` | 6-hourly | Egress bandwidth (image downloads) |

#### D1 (SQLite on Workers)
| Metric | Source | Query Method | Frequency | Notes |
|--------|--------|--------------|-----------|-------|
| **Query Latency (p50, p95, p99)** | Tail Workers / D1 Query Logs | Custom Tail Worker | 1-hourly | Requires instrumentation in backend-d1-saas |
| **Database Size (bytes)** | D1 Metadata | `SELECT page_count * page_size FROM pragma_page_count, pragma_page_size` | 24-hourly | Per-tenant database size |
| **Request Rate** | Tail Workers | Log HTTP requests to D1 | 1-hourly | Requests per minute (scale metric) |
| **Error Rate** | Tail Workers | Log 5xx/4xx responses | 1-hourly | Query failures for alerting |

#### Cloudflare Analytics Engine
| Metric | Source | Query Method | Frequency | Notes |
|--------|--------|--------------|-----------|-------|
| **Page Views** | Analytics Engine | GraphQL query via Workers API | 1-hourly | Total requests to origin (frontend) |
| **Bandwidth (GB)** | Analytics Engine | GraphQL query via Workers API | 6-hourly | Egress bandwidth from Cloudflare |
| **Cache Hit Ratio** | Analytics Engine | `(cacheStatus == 'HIT') / total` | 1-hourly | Cache efficiency metric |
| **Request Count by Status** | Analytics Engine | Group by status code (2xx, 3xx, 4xx, 5xx) | 1-hourly | Traffic health snapshot |
| **Unique IPs** | Analytics Engine | Cardinality of client IPs | 24-hourly | Geographic distribution, DDoS detection |

### 2.3 Data Transformation Requirements

#### Normalization Rules

**Timestamps**
- All timestamps must be ISO 8601 UTC (e.g., `2026-05-07T14:30:00Z`)
- Store raw DB timestamps in local TZ, convert to UTC for API response
- Bucket timestamps by hour/day/week for aggregation

**Naming Conventions**
- Snake_case for all JSON response fields
- Prefix metrics with source: `supabase_`, `cloudflare_`, `computed_`
- Example: `supabase_total_users`, `cloudflare_r2_storage_bytes`, `computed_growth_rate_pct`

**Numeric Precision**
- Byte counts: integers (no decimals)
- Percentages: 2 decimal places (e.g., 73.45%)
- Latency: milliseconds (integers)
- Durations: seconds (floats allowed)

#### Computed Metrics

| Metric | Formula | Update Frequency | Data Quality Notes |
|--------|---------|------------------|-------------------|
| **Growth Rate (%)** | `((Current - Previous) / Previous) * 100` | Daily | Use 7-day or 30-day baseline |
| **Churn Rate (%)** | `(Inactive Users / Total Users Last Period) * 100` | Weekly | Inactive = no views in 14 days |
| **Engagement Score** | `(Views + Likes*2 + Favorites*3) / Active Users` | 6-hourly | Weighted sum for user quality |
| **Storage Efficiency** | `Active Stories / Storage Used (GB)` | Daily | Stories per GB to track space optimization |
| **Bandwidth per User** | `Egress Bandwidth (GB) / DAU` | Daily | Infrastructure cost per user |
| **Chapter Completion %** | `Users completed chapter X / Users started chapter X` | Daily | Dropped users = churn risk |
| **Avg Session Duration (min)** | Derived from viewer IP sessions or event logs | Real-time | May require event tracking implementation |

### 2.4 Data Integration Architecture

#### Proposed Flow: Serverless Worker Aggregator (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard Consumer (Next.js Frontend)                       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP GET /api/analytics/{time_range}
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js Server API Route (Auth Gate)                        │
│  - Validate user role (admin/superadmin only)               │
│  - Parse time_range query param (24h, 7d, 30d, custom)      │
│  - Call Worker via signed request                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (Aggregator)                              │
│  - Fetch Supabase metrics (cached in Workers KV)            │
│  - Fetch R2 metrics (API call)                              │
│  - Fetch Cloudflare Analytics (GraphQL)                     │
│  - Fetch D1 metrics (Tail Workers log query)                │
│  - Compute derived metrics                                   │
│  - Return JSON with 5-min cache                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
         ┌──────────────────┐   ┌──────────────────┐
         │ Supabase RPC     │   │ Cloudflare APIs  │
         │ (Aggregates)     │   │ (R2, Analytics)  │
         │                  │   │                  │
         │ - User count     │   │ - Storage size   │
         │ - Signup trend   │   │ - Bandwidth      │
         │ - Top stories    │   │ - Cache ratio    │
         │ - Read patterns  │   │ - Query latency  │
         └──────────────────┘   └──────────────────┘
```

**Benefits:**
- Offload aggregation from Supabase (reduce RPC load)
- Cache results in Workers KV for sub-second response times
- No direct DB calls from UI (security best practice)
- Supports role-based data filtering at edge

#### Alternative: Client-Side Aggregation (Not Recommended)

- Direct Supabase queries in React components
- **Cons**: Violates clean architecture, exposes DB to client, poor performance, hard to implement role checks

---

## 3. Scope Definition

### 3.1 In-Scope Features

#### Core Dashboard Views

1. **User Engagement Overview**
   - Total users, new sign-ups, active users (DAU/WAU/MAU)
   - Churn rate and trend line
   - Sign-up cohort retention curve
   - Geographic distribution (if IP data available)

2. **Content Performance**
   - Top 10 stories by views, likes, favorites
   - Top 10 chapters by reads
   - Story/chapter completion rates
   - Trending stories (velocity-based ranking)
   - Category breakdown (if applicable)

3. **Infrastructure Health**
   - R2 storage usage (covers + chapters buckets)
   - Monthly bandwidth and traffic trends
   - D1 query latency (p50, p95)
   - Cache hit ratio and traffic patterns

4. **Custom Filters**
   - Time range selection: 24h, 7d, 30d, custom date picker
   - Role-based view (admin sees all; content manager sees own stories)
   - Category filter (content manager view)
   - Export to CSV/PDF for reports

5. **Real-time Alerts**
   - Anomaly detection: sudden traffic drop, spike in errors
   - Threshold alerts: R2 storage approaching limit, query latency > 200ms
   - Toast notifications for critical issues

#### Implementation Details
- **Granularity**: Hourly aggregation for 24h data, daily for 7d/30d
- **Latency SLA**: Dashboard loads in <2 seconds (p95)
- **Data Accuracy**: Within 5-10 minutes of real-time
- **Refresh**: Auto-refresh every 5 minutes for live dashboard

### 3.2 Out-of-Scope (Phase 2+)

- Real-time event streaming (complex; would require WebSockets + event ingestion)
- Predictive analytics / ML-based recommendations
- Third-party integrations (Google Analytics, Amplitude)
- Custom report builder / SQL editor for admins
- Data warehouse ETL (data lake setup)
- Mobile app analytics (separate implementation)
- Ad performance analytics (deferred pending ad system maturity)
- User behavior heatmaps / session replays

### 3.3 Time Range Aggregation Strategy

| Time Range | Aggregation Granule | Retention | Query Performance |
|------------|-------------------|-----------|-------------------|
| **24 hours** | Hourly | 7 days | Real-time (cache 1m) |
| **7 days** | Daily | 90 days | Near real-time (cache 10m) |
| **30 days** | Daily | 2 years | Cached (cache 1h) |
| **Custom** | Daily (user-selected granule) | On-demand | Computed (cache 1h) |

### 3.4 Data Refresh Strategy

#### Real-time (1-hour SLA)
- User engagement metrics (DAU, sign-ups, new favorites)
- Top stories/chapters (volatile, changes hourly)
- Cache hit ratio, request rates

#### Near Real-time (6-hour SLA)
- Weekly/monthly active users
- Content performance aggregates
- R2 request metrics

#### Batch (24-hour SLA)
- R2 storage size, database size
- Historical cohort analysis
- Monthly trend reports

### 3.5 Refresh Frequency by Audience

| Persona | Check Frequency | Critical Metrics | Acceptable Lag |
|---------|-----------------|------------------|----------------|
| **Ops Manager** | Every 1-2h | Latency, errors, bandwidth | 5 min |
| **Platform Admin** | 1x/day morning | User growth, top stories | 1h |
| **Content Manager** | 2-3x/week | Top chapters, engagement | 6h |
| **BI Team** | 1x/week monthly reports | Cohorts, trends | 24h |

---

## 4. Technical Requirements

### 4.1 JSON Response Structure

```json
{
  "timestamp": "2026-05-07T14:30:00Z",
  "time_range": "24h",
  "user_engagement": {
    "total_users": 15430,
    "new_signups_today": 127,
    "daily_active_users": 4821,
    "weekly_active_users": 9340,
    "monthly_active_users": 13200,
    "churn_rate_pct": 2.3,
    "avg_session_duration_minutes": 12.4,
    "favorites_per_active_user": 2.1,
    "growth_rate_pct": 5.2
  },
  "content_performance": {
    "top_stories": [
      {
        "story_id": "uuid-1",
        "title": "The Lost Kingdom",
        "views": 5420,
        "likes": 342,
        "favorites": 198,
        "avg_completion_pct": 76.5,
        "trending_score": 1024
      }
    ],
    "top_chapters": [
      {
        "chapter_id": "uuid-1",
        "story_title": "The Lost Kingdom",
        "chapter_number": 5,
        "reads": 1203,
        "completion_pct": 82.1
      }
    ],
    "total_chapters_published": 342,
    "avg_reads_per_chapter": 487
  },
  "infrastructure": {
    "r2_storage_used_gb": 24.3,
    "r2_request_quota_used_pct": 12.5,
    "d1_query_latency_ms": {
      "p50": 45,
      "p95": 120,
      "p99": 250
    },
    "cloudflare_bandwidth_gb": 156.2,
    "cache_hit_ratio_pct": 73.4,
    "errors_24h": {
      "4xx_count": 234,
      "5xx_count": 12,
      "5xx_rate_pct": 0.03
    }
  },
  "computed_metrics": {
    "storage_efficiency_stories_per_gb": 14.2,
    "bandwidth_per_user_mb": 10.8,
    "infrastructure_cost_estimate_usd": 45.20
  },
  "cache_info": {
    "generated_at": "2026-05-07T14:25:00Z",
    "ttl_seconds": 300
  }
}
```

### 4.2 API Endpoints

#### Endpoint 1: Dashboard Summary (All Metrics)
```
GET /api/internal/admin/analytics/dashboard?time_range=24h
```
**Params:**
- `time_range`: "24h" (default), "7d", "30d", or "start_date=2026-05-01&end_date=2026-05-07"

**Response:** Full dashboard payload (see 4.1)

**Auth:** Requires `admin` or `superadmin` role

#### Endpoint 2: User Engagement Only
```
GET /api/internal/admin/analytics/engagement?time_range=7d
```
**Response:** `user_engagement` object only

**Auth:** Requires `admin` role; `employee` can filter by assigned stories

#### Endpoint 3: Content Performance (Filtered)
```
GET /api/internal/admin/analytics/content?time_range=30d&category=fantasy&created_by={user_id}
```
**Params:**
- `category`: (optional) filter by story category
- `created_by`: (optional) filter by author UUID
- `sort_by`: "views" (default), "engagement_score", "completion_rate"

**Response:** `content_performance` object

**Auth:** `employee` can view own stories; `admin` can view all

#### Endpoint 4: Infrastructure Metrics
```
GET /api/internal/admin/analytics/infrastructure?time_range=7d
```
**Response:** `infrastructure` object + `computed_metrics`

**Auth:** Requires `admin` or `superadmin` role (ops team only)

#### Endpoint 5: Export Report
```
POST /api/internal/admin/analytics/export
Content-Type: application/json

{
  "format": "csv" | "pdf",
  "metrics": ["engagement", "content", "infrastructure"],
  "time_range": "7d",
  "include_trends": true
}
```
**Response:** File download or signed URL

**Auth:** Requires `admin` or `superadmin` role

### 4.3 Next.js Server API Implementation Pattern

**File:** `frontend/src/app/api/internal/admin/analytics/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '@/infrastructure/auth/serverAuth';
import { fetchAnalyticsSummary } from '@/services/analytics.service';

export async function GET(request: NextRequest) {
  // 1. Validate auth
  const user = await validateAdminAuth(request);
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // 2. Parse query params
  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('time_range') || '24h';
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  // 3. Fetch aggregated data from Worker
  const analytics = await fetchAnalyticsSummary({
    timeRange,
    startDate,
    endDate,
  });

  // 4. Return JSON response (cached by Worker)
  return NextResponse.json(analytics, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
```

### 4.4 Cloudflare Worker Aggregator Template

**File:** `backend-d1-saas/src/analytics-worker.ts` (or separate service)

```typescript
import { Router } from 'itty-router';

const router = Router();

interface AnalyticsEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  KV: KVNamespace;
}

async function fetchSupabaseMetrics(env: AnalyticsEnv, timeRange: string) {
  // Aggregate user engagement, content performance from Supabase
  const cacheKey = `supabase_${timeRange}`;
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) return cached;

  // Query Supabase RPC for aggregates
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_analytics_summary`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ time_range: timeRange }),
  });

  const data = await response.json();
  await env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
  return data;
}

async function fetchCloudflareMetrics(env: AnalyticsEnv, timeRange: string) {
  // Fetch R2 storage, bandwidth, query latency from CF APIs
  const cacheKey = `cloudflare_${timeRange}`;
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) return cached;

  // Query R2 API, Analytics Engine, Tail Workers logs
  const [r2Metrics, analyticsMetrics, d1Metrics] = await Promise.all([
    fetchR2Metrics(env),
    fetchAnalyticsEngineMetrics(env, timeRange),
    fetchD1Metrics(env),
  ]);

  const data = { r2: r2Metrics, analytics: analyticsMetrics, d1: d1Metrics };
  await env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 600 });
  return data;
}

router.get('/analytics/summary', async (request, env: AnalyticsEnv) => {
  const url = new URL(request.url);
  const timeRange = url.searchParams.get('time_range') || '24h';

  const [supabase, cloudflare] = await Promise.all([
    fetchSupabaseMetrics(env, timeRange),
    fetchCloudflareMetrics(env, timeRange),
  ]);

  return new Response(JSON.stringify({
    user_engagement: supabase.engagement,
    content_performance: supabase.content,
    infrastructure: cloudflare,
    timestamp: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
});

export default router;
```

### 4.5 Supabase RPC for Aggregation

Create a Supabase function to aggregate metrics:

**File:** `backend-supabase/supabase/functions/get_analytics_summary/index.ts`

```sql
create or replace function public.get_analytics_summary(time_range text)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_users', (select count(*) from profiles),
    'new_signups_today', (select count(*) from profiles where created_at > now() - interval '1 day'),
    'daily_active_users', (select count(distinct viewed_by) from story_views where viewed_at > now() - interval '1 day'),
    'top_stories', (
      select json_agg(row_to_json(t)) from (
        select id, title, views, like_count from stories order by views desc limit 10
      ) t
    ),
    'churn_rate_pct', (
      select round(100.0 * count(*) / (select count(*) from profiles where created_at < now() - interval '14 days'), 2)
      from profiles
      where created_at < now() - interval '14 days'
        and id not in (select distinct viewed_by from story_views where viewed_at > now() - interval '14 days')
    )
  );
$$;

grant execute on function public.get_analytics_summary(text) to authenticated, service_role;
```

---

## 5. Assumptions & Constraints

### 5.1 Assumptions

1. **Data Availability**
   - Supabase RLS policies do not prevent admin queries
   - Cloudflare API tokens have R2, Analytics, and D1 permissions
   - D1 query logs are accessible via Tail Workers
   - User roles are correctly set in `app_metadata` (not `user_metadata`)

2. **User Behavior**
   - Users accept 5-10 minute data lag for analytical insights
   - Admins access dashboard 1-3x per day (not real-time monitoring)
   - Content managers focus on their own stories/chapters primarily

3. **Infrastructure**
   - R2 storage < 100 GB (single bucket per tier)
   - D1 databases < 50 GB each (multi-tenant, lightweight)
   - Cloudflare Analytics API available without additional setup

4. **Scale Expectations**
   - Baseline: <100K users, <10K stories, <50K chapters
   - Growth: 10-50% MoM (not hyperscale)
   - Query load: <100 RPS to Supabase, <10 RPS to D1

### 5.2 Constraints

1. **Authentication**
   - Dashboard requires valid Supabase session in browser
   - Server API routes enforce role-based access (admin/superadmin/employee)
   - No public/anonymous dashboard access

2. **Data Scope**
   - Only Supabase-authenticated users visible in metrics (anonymous views not tracked by default)
   - D1 tenant data isolated per comic; global D1 metrics require aggregation across tenants
   - Historical data retention: 90 days for hourly, 2 years for daily

3. **Performance**
   - Supabase RPC queries must complete in <3 seconds (Worker timeout)
   - Worker cache TTL: 5 min (user engagement), 1 h (infrastructure metrics)
   - Dashboard must load in <2 seconds (p95 latency target)

4. **Cost Optimization**
   - Minimize Supabase query volume (use RPC, not individual tables)
   - Use Workers KV for caching (vs. repeated Cloudflare API calls)
   - R2 requests should be infrequent (once per day sufficient)
   - D1 queries via Tail Workers (log sampling, not real-time instrumentation)

5. **Security**
   - All dashboard queries require authentication (no guest access)
   - Role-based filtering: admins see all, employees see own, users see public only
   - API responses do not leak sensitive infrastructure costs in client responses (only in admin export)
   - Supabase service role key stored securely (env var, never in client code)

### 5.3 Known Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Stale Metrics** | Admins make decisions on old data | Use 5-10 min cache TTL; implement WebSocket updates (Phase 2) |
| **Query Performance** | Dashboard slow to load | RPC aggregation in Supabase; Worker caching; lazy-load charts |
| **Data Leakage** | Employees see other stories | Role-based RLS in Supabase; filter in API route |
| **Cloudflare API Quota** | Exceeded API call limits | Batch queries; cache aggressively; implement backoff |
| **D1 Cost Growth** | Expensive multi-tenant setup | Monitor query patterns; disable slow queries; optimize schema |
| **Infrastructure Blind Spots** | Missing critical alerts | Set up monitoring dashboards; implement 2xx error detection |

---

## 6. Success Criteria

### 6.1 Functional Success Metrics

| Criterion | Target | Measurement | Timeframe |
|-----------|--------|-------------|-----------|
| **Dashboard Load Time** | <2 sec (p95) | Lighthouse/DevTools | Day 1 |
| **Data Accuracy** | Within ±10% of source DBs | Compare dashboard vs. raw query | Week 1 |
| **API Response Time** | <500ms (p95) | Application Performance Monitoring (APM) | Week 1 |
| **Uptime** | 99.5% | Uptime monitoring service | Week 2+ |
| **Time Range Filter Coverage** | 24h, 7d, 30d, custom all working | Manual QA | Day 1 |
| **Role-Based Access** | Admin sees all, employee sees own | Role-based testing matrix | Day 2 |
| **Export Functionality** | CSV/PDF working for all metrics | Download and validate files | Week 1 |

### 6.2 Business Success Metrics

| Goal | Success Indicator | Baseline | Target | Timeline |
|------|------------------|----------|--------|----------|
| **Improve Retention** | User review dashboard → identify churn → re-engagement campaign launched | 0 campaigns | 2+ campaigns | Month 1 |
| **Optimize Content** | Top stories identified; content team adjusts strategy | Manual tracking | Automated top-10 list | Week 1 |
| **Cost Control** | Infrastructure costs monitored and optimized | Unknown | <$100/mo R2 | Month 1 |
| **Faster Decisions** | Ops team response time to anomalies | N/A | <30 min avg | Week 2 |
| **User Engagement** | Content manager identifies high-engagement chapters; promotes them | 0 promoted | 5+ per week | Month 2 |
| **Data-Driven Planning** | Monthly exec reports generated from dashboard | Manual data gathering | 1-click PDF export | Week 2 |

### 6.3 Technical Success Metrics

| Criterion | Success Threshold | Validation |
|-----------|------------------|-----------|
| **RLS Enforcement** | No data leakage in API responses | Security audit; role-based testing |
| **Cache Efficiency** | >80% Worker KV hit rate | Cloudflare analytics; log review |
| **Query Optimization** | Supabase RPC <500ms for aggregate queries | Database query logs; APM traces |
| **Zero Manual Aggregation** | All dashboards auto-populated | No Excel/CSV manual work required |
| **Mobile Responsive** | Dashboard usable on tablet (>768px) | Responsive testing on iPad/Pixel |
| **Accessibility** | WCAG 2.1 AA compliance | axe DevTools audit; keyboard nav test |

---

## 7. Recommended Next Steps (Implementation Roadmap)

### Phase 1: MVP (Week 1-2)
1. Create Supabase RPC function for user engagement + content performance aggregation
2. Build Next.js server API route with role-based access control
3. Design dashboard UI with 4 core sections: Users, Top Stories, Top Chapters, Infrastructure
4. Implement 24h time range filter only (support 7d/30d in Phase 2)
5. Deploy to staging; validate data accuracy vs. raw queries

### Phase 2: Enhancement (Week 3-4)
1. Add Cloudflare Worker aggregator for R2 + Analytics Engine metrics
2. Extend time range filters to 7d, 30d, custom date picker
3. Implement caching strategy (Workers KV for metrics, Redis for session)
4. Add trending/velocity-based story ranking
5. Create CSV export endpoint

### Phase 3: Optimization (Week 5-6)
1. Set up APM/monitoring for dashboard latency
2. Implement anomaly detection and alerts (Slack integration)
3. Add D1 query latency instrumentation via Tail Workers
4. Build BI team features: cohort analysis, retention curves
5. Performance optimization: lazy-load charts, pagination for top-N lists

### Phase 4: Scale (Week 7+)
1. Data warehouse integration (Parquet export to S3/R2)
2. Real-time metrics via WebSocket (optional)
3. Predictive analytics (churn prediction, content recommendations)
4. Third-party integrations (Google Analytics, Segment)
5. Custom report builder for admins

---

## 8. Acceptance Criteria

Dashboard is considered **COMPLETE** when:

- ✅ All 4 data sources integrated (Supabase engagement, content, Cloudflare infra, D1)
- ✅ Time range filters working (24h, 7d, 30d)
- ✅ Role-based access enforced (admin sees all, employee sees own, user sees none)
- ✅ Dashboard loads in <2 seconds (p95)
- ✅ All metrics accurate within ±10% of raw queries
- ✅ Admin can export to CSV
- ✅ No sensitive data exposed in client responses
- ✅ Zero RLS/authorization bypass vulnerabilities
- ✅ Tested on desktop, tablet, mobile breakpoints
- ✅ Documentation complete (API endpoints, metric definitions, troubleshooting guide)
- ✅ Deployed to production with monitoring

---

## Appendix A: Metric Definitions Reference

### User Engagement Metrics
- **DAU**: Unique user IDs in `story_views` table with `viewed_at` in last 24 hours
- **WAU**: Unique user IDs in `story_views` with `viewed_at` in last 7 days
- **New Sign-ups**: `COUNT(*) FROM profiles WHERE created_at > DATE_TRUNC('day', now())`
- **Churn Rate**: Users with no views in 14+ days / Total users from 15+ days ago
- **Favorites**: `COUNT(DISTINCT user_id) FROM story_likes`

### Content Performance Metrics
- **Top Stories**: `SELECT * FROM stories ORDER BY views DESC LIMIT 10`
- **Top Chapters**: `SELECT c.*, COUNT(DISTINCT sv.viewed_by) as reads FROM chapters c LEFT JOIN story_views sv ON sv.story_id = c.story_id GROUP BY c.id ORDER BY reads DESC`
- **Completion Rate**: `(Chapters where viewed_at = max(chapter_created_at)) / (Chapters where viewed_at >= min(chapter_created_at)) * 100`

### Infrastructure Metrics
- **R2 Storage**: `GET /accounts/{id}/storage/buckets` API response
- **D1 Latency**: 95th percentile of query execution time from Tail Workers logs
- **Cache Hit Ratio**: `(Requests with cf-cache-status: HIT) / Total Requests * 100`

---

**Document Version:** 1.0  
**Author:** Business Analyst  
**Date:** 2026-05-07  
**Status:** Ready for Technical Specification & Implementation
