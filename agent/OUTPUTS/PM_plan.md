# PM Plan: Analytics Dashboard Implementation

## Overview

**Scope**: Build a unified Analytics Dashboard consolidating user engagement metrics (Supabase), content performance data, and infrastructure metrics (Cloudflare) into a real-time operational center for admins, ops teams, and content managers.

**Timeline**: 
- **MVP (2 weeks)**: Core dashboard (user engagement, top content, basic infrastructure metrics)
- **Full Feature Set (6 weeks)**: Advanced filters, custom reports, anomaly alerts, multi-tenant support

**High-Level Approach**: 
1. Build backend data aggregation layer (Supabase RPCs + Cloudflare Worker aggregator)
2. Develop Next.js server API routes with role-based access control
3. Create React UI components with React Query for data fetching
4. Implement caching strategy (Workers KV + React Query) for sub-second response times
5. Validate with comprehensive testing (unit, integration, load tests)

**Key Constraints**:
- No production outages during rollout
- Cannot break existing admin dashboard
- Frontend bundle remains <3MiB gzipped
- Must maintain strict role-based access control (RLS + server-side validation)

---

## Work Breakdown Structure

### Epic 1: Backend Data Aggregation Layer

#### Story 1.1: Supabase RPC Functions (User Engagement)
- **Effort**: 13 story points
- **Duration**: 2-3 days (backend dev)

Tasks:
- Design RPC schema for engagement metrics (DAU, WAU, MAU, churn rate)
- Implement `get_user_engagement_summary(time_range, start_date, end_date)` RPC
- Implement `get_signup_trend(days_back)` RPC for cohort analysis
- Implement `get_inactive_user_cohort(inactive_days)` RPC for churn analysis
- Add caching headers to RPCs for performance optimization

**Acceptance**: All RPCs return data within 2 seconds; results match manual SQL queries

#### Story 1.2: Supabase RPC Functions (Content Performance)
- **Effort**: 13 story points
- **Duration**: 2-3 days (backend dev)

Tasks:
- Implement `get_top_stories_by_metric(metric, limit, time_range)` RPC
- Implement `get_top_chapters_by_reads(limit, time_range)` RPC
- Implement `get_story_completion_rates(story_id)` RPC
- Implement `get_chapter_completion_rates(story_id)` RPC
- Implement `get_trending_stories(lookback_days)` RPC (velocity-based ranking)

**Acceptance**: RPCs return ranked data; completion rates match calculated values; response <2s

#### Story 1.3: Cloudflare Worker Aggregator
- **Effort**: 21 story points
- **Duration**: 3-4 days (backend dev)

Tasks:
- Set up Cloudflare Worker project with TypeScript
- Implement auth middleware (validate Admin API key)
- Build aggregator function to fetch from Supabase RPCs
- Build aggregator function to fetch R2 metrics (storage, request count, bandwidth)
- Build aggregator function to fetch Cloudflare Analytics Engine (cache ratio, traffic)
- Build aggregator function to fetch D1 query latency metrics (from Tail Workers)
- Implement computed metrics (storage efficiency, bandwidth per user, engagement score)
- Add error handling and fallback responses for failed data sources
- Cache aggregator results in Workers KV (5-min TTL for 24h data, 1h for 7d/30d)

**Acceptance**: Worker returns complete dashboard JSON in <500ms; KV cache working; no API errors

#### Story 1.4: D1 Metrics Collection (Tail Worker)
- **Effort**: 8 story points
- **Duration**: 1-2 days (backend dev / DevOps)

Tasks:
- Create Tail Worker to log D1 query latencies to Workers Analytics Engine
- Capture query execution time, error rate, database size per tenant
- Instrument backend-d1-saas to report metrics on each request
- Expose metrics query endpoint in Analytics Worker
- Set up alerting for query latency spikes (p95 > 200ms)

**Acceptance**: Tail Worker captures metrics; Analytics Worker can retrieve p50/p95/p99 latencies

### Epic 2: Next.js Server API Routes

#### Story 2.1: Authentication & Authorization Middleware
- **Effort**: 8 story points
- **Duration**: 1-2 days (backend dev)

Tasks:
- Create `validateAdminAuth()` middleware for API routes
- Implement role-based access control (admin, superadmin, employee, viewer)
- Add JWT token validation and session management
- Implement signed Worker request authentication (HMAC-SHA256)
- Add request logging and audit trail for analytics access

**Acceptance**: Middleware blocks unauthorized requests; audit logs track all access

#### Story 2.2: Core Analytics API Routes
- **Effort**: 13 story points
- **Duration**: 2-3 days (backend dev)

Tasks:
- Create `GET /api/internal/admin/analytics/dashboard` endpoint
- Create `GET /api/internal/admin/analytics/engagement` endpoint
- Create `GET /api/internal/admin/analytics/content` endpoint (with filtering by author/category)
- Create `GET /api/internal/admin/analytics/infrastructure` endpoint
- Implement query parameter parsing (time_range, date range, filters)
- Add response validation and schema enforcement
- Implement HTTP caching headers (Cache-Control, ETag)

**Acceptance**: All endpoints return correct data; caching headers respected; role filtering works

#### Story 2.3: Export & Reporting Endpoints
- **Effort**: 13 story points
- **Duration**: 2-3 days (backend dev)

Tasks:
- Create `POST /api/internal/admin/analytics/export` endpoint (CSV format)
- Create PDF export endpoint (using node-pdf or similar library)
- Implement async job queue for large report generation
- Add signed download URLs for secure file delivery
- Implement report scheduling API (optional for MVP)

**Acceptance**: CSV/PDF exports contain correct data; file size reasonable (<10MB); secure URLs work

#### Story 2.4: Rate Limiting & Performance Optimization
- **Effort**: 5 story points
- **Duration**: 1 day (backend dev)

Tasks:
- Implement rate limiting (100 req/min per user)
- Add response compression (gzip)
- Implement SWR (stale-while-revalidate) caching strategy
- Add request deduplication for concurrent dashboard loads
- Monitor API response times and set up alerts

**Acceptance**: Rate limiting enforced; response times <200ms p95; no duplicate requests logged

### Epic 3: Frontend UI Components

#### Story 3.1: Dashboard Layout & Core Components
- **Effort**: 13 story points
- **Duration**: 2-3 days (frontend dev)

Tasks:
- Create `AnalyticsDashboard` root component with layout
- Create `TimeRangeSelector` component (24h, 7d, 30d, custom date picker)
- Create `MetricsCard` component for displaying KPI values with trend arrows
- Create `Chart` component wrapper (using Recharts or Chart.js)
- Create `LoadingState` and `ErrorState` components with retry logic
- Create `FilterPanel` component for category/author/role-based filtering

**Acceptance**: Layout responsive on desktop/tablet; all interactive elements functional; no console errors

#### Story 3.2: User Engagement Section
- **Effort**: 8 story points
- **Duration**: 1-2 days (frontend dev)

Tasks:
- Create `EngagementMetrics` component (DAU, WAU, MAU, churn, signup trend)
- Create `EngagementChart` component (line chart for trends over time)
- Create `CohortRetentionTable` component (retention curve visualization)
- Create `DemographicsPanel` component (geographic distribution, if applicable)
- Integrate `useAnalyticsEngagement()` React Query hook

**Acceptance**: Metrics display correctly; charts render for all time ranges; no data fetch errors

#### Story 3.3: Content Performance Section
- **Effort**: 13 story points
- **Duration**: 2-3 days (frontend dev)

Tasks:
- Create `TopStoriesTable` component (sortable, paginated table)
- Create `TopChaptersTable` component with drill-down to story
- Create `CompletionRateChart` component (stacked bar chart by story/chapter)
- Create `TrendingContentCarousel` component (top 5 trending stories)
- Create `ContentFilterPanel` component (category, author, time range)
- Implement drill-down navigation (story → chapters → reader engagement)

**Acceptance**: Tables sortable and paginated; drill-down navigation works; no missing data rows

#### Story 3.4: Infrastructure Metrics Section
- **Effort**: 8 story points
- **Duration**: 1-2 days (frontend dev)

Tasks:
- Create `InfrastructureOverview` component (R2 storage, D1 latency, cache ratio)
- Create `StorageBreakdownChart` component (donut chart: covers vs. chapters)
- Create `LatencyChart` component (p50/p95/p99 over time)
- Create `BandwidthTrendChart` component (area chart)
- Create `CacheHealthWidget` component with status indicator

**Acceptance**: All metrics display; charts render correctly; color-coded status indicators show health

#### Story 3.5: Advanced Filters & Export
- **Effort**: 8 story points
- **Duration**: 1-2 days (frontend dev)

Tasks:
- Create `ExportModal` component (CSV, PDF format selection)
- Create `CustomDateRangeSelector` component (calendar picker)
- Create `RoleBasedViewToggle` component (switch between admin/content manager views)
- Create `PresetReportsMenu` component (saved reports, quick access)
- Implement URL state persistence (shareable dashboard links)

**Acceptance**: Export generates correct files; date range respected; role toggling works; URLs shareable

#### Story 3.6: Performance Optimization & Accessibility
- **Effort**: 5 story points
- **Duration**: 1 day (frontend dev)

Tasks:
- Implement code splitting for analytics routes
- Add React.memo for chart components (prevent unnecessary re-renders)
- Implement lazy loading for tables (virtualization for large datasets)
- Add accessibility labels (ARIA) for screen readers
- Add keyboard navigation support
- Test bundle size (ensure <3MiB gzipped impact)

**Acceptance**: Lighthouse accessibility score >90; bundle impact <500KB; keyboard navigation works

### Epic 4: Data Fetching & State Management

#### Story 4.1: React Query Hooks
- **Effort**: 13 story points
- **Duration**: 2-3 days (frontend dev)

Tasks:
- Create `useAnalyticsDashboard(timeRange)` hook
- Create `useAnalyticsEngagement(timeRange, filters)` hook
- Create `useAnalyticsContent(timeRange, filters)` hook
- Create `useAnalyticsInfrastructure(timeRange)` hook
- Create `useExportAnalytics()` hook for file generation
- Implement error handling and retry logic
- Implement stale-while-revalidate pattern
- Add request deduplication (avoid concurrent identical queries)

**Acceptance**: Hooks return correct data; caching working; refetch/invalidate works; no console warnings

#### Story 4.2: Optimistic Updates & Real-time Subscriptions
- **Effort**: 8 story points
- **Duration**: 1-2 days (frontend dev)

Tasks:
- Implement optimistic loading states (skeleton screens)
- Implement auto-refresh polling (5-min interval)
- Add WebSocket/polling for real-time metric updates (optional for MVP)
- Implement alert notifications for anomalies
- Add manual refresh button with loading state

**Acceptance**: Auto-refresh works on 5-min interval; manual refresh responsive; alerts display correctly

### Epic 5: Testing & Quality Assurance

#### Story 5.1: Backend Unit Tests
- **Effort**: 13 story points
- **Duration**: 2-3 days (QA / backend dev)

Tasks:
- Write unit tests for each Supabase RPC function
- Write unit tests for Worker aggregator functions
- Write tests for computed metrics calculations
- Write tests for error handling and fallback logic
- Aim for >80% code coverage on business logic

**Acceptance**: All tests pass; coverage report shows >80% coverage; no flaky tests

#### Story 5.2: Integration Tests (API Routes)
- **Effort**: 13 story points
- **Duration**: 2-3 days (QA / backend dev)

Tasks:
- Write integration tests for each Next.js API endpoint
- Test authentication and authorization (blocked/allowed scenarios)
- Test data filtering and role-based access
- Test rate limiting and caching behavior
- Test export functionality (CSV/PDF generation)

**Acceptance**: All integration tests pass; rate limiting verified; exports validated

#### Story 5.3: Frontend Component Tests
- **Effort**: 13 story points
- **Duration**: 2-3 days (QA / frontend dev)

Tasks:
- Write component tests for dashboard layout
- Write tests for chart rendering and data updates
- Write tests for table sorting, pagination, filtering
- Write tests for export modal and date picker
- Write accessibility tests (ARIA labels, keyboard navigation)

**Acceptance**: Component tests pass; accessibility tests pass; no rendering errors

#### Story 5.4: Load Testing & Performance Validation
- **Effort**: 8 story points
- **Duration**: 1-2 days (QA / DevOps)

Tasks:
- Set up load test for Worker aggregator (target: 1000 req/s)
- Set up load test for API routes (target: 500 req/s)
- Test dashboard UI with slow network (3G throttling)
- Measure dashboard load time (target: <2s p95)
- Validate bundle size (target: <3MiB gzipped)

**Acceptance**: Load tests pass; response times meet targets; bundle size validated

#### Story 5.5: End-to-End Testing (Staging)
- **Effort**: 8 story points
- **Duration**: 1-2 days (QA)

Tasks:
- Create E2E test scenarios for each dashboard section
- Test complete user flows (login → filter → export)
- Test cross-browser compatibility (Chrome, Firefox, Safari)
- Test mobile responsiveness (iOS/Android)
- Validate data accuracy against source systems

**Acceptance**: All E2E tests pass; data matches source systems; no cross-browser issues

#### Story 5.6: Security & Compliance Audit
- **Effort**: 5 story points
- **Duration**: 1 day (QA / DevOps)

Tasks:
- Verify role-based access control (RLS policies enforced)
- Check for data leaks in API responses
- Validate JWT token handling
- Review error messages (no sensitive info exposed)
- Ensure HTTPS and secure headers in place

**Acceptance**: Security audit passes; no data leaks found; OWASP Top 10 items addressed

### Epic 6: DevOps & Infrastructure

#### Story 6.1: Cloudflare Worker Deployment
- **Effort**: 5 story points
- **Duration**: 1 day (DevOps)

Tasks:
- Set up Cloudflare Worker environment (staging + production)
- Configure Worker secrets (API keys, auth tokens)
- Deploy analytics Worker to production
- Set up monitoring and alerting for Worker errors
- Configure auto-scaling and rate limiting

**Acceptance**: Worker deployed; monitoring in place; no critical errors in logs

#### Story 6.2: Workers KV Cache Setup
- **Effort**: 5 story points
- **Duration**: 1 day (DevOps)

Tasks:
- Create KV namespace for analytics cache
- Configure TTL policies (5min for 24h, 1h for 7d/30d)
- Set up cache invalidation triggers
- Monitor KV quota usage
- Set up alerts for cache misses/errors

**Acceptance**: KV cache operational; TTL policies enforced; quota monitoring active

#### Story 6.3: Observability & Monitoring
- **Effort**: 8 story points
- **Duration**: 1-2 days (DevOps)

Tasks:
- Set up Cloudflare Tail Workers for logging
- Configure Datadog/New Relic for APM (if available)
- Create dashboards for API latency, error rates, cache hit ratio
- Set up alerting for:
  - Worker response time > 1s
  - Error rate > 1%
  - Cache miss rate > 30%
  - R2 storage approaching quota
- Configure log retention and archival

**Acceptance**: Dashboards created; alerts configured; logs flowing; retention policies active

#### Story 6.4: Database Optimization (Supabase)
- **Effort**: 5 story points
- **Duration**: 1 day (DevOps)

Tasks:
- Index Supabase tables for RPC performance (`story_views`, `story_likes`, `stories`)
- Optimize RPC query plans (explain analyze)
- Set up connection pooling
- Configure query timeout limits
- Monitor query performance metrics

**Acceptance**: Indexes applied; query plans optimized; no slow query logs

#### Story 6.5: D1 Metrics Instrumentation
- **Effort**: 5 story points
- **Duration**: 1 day (DevOps)

Tasks:
- Deploy Tail Worker to capture D1 metrics
- Configure Analytics Engine event schema
- Set up dashboards for D1 latency/error trends
- Create alerts for performance degradation
- Document metric collection schema

**Acceptance**: Tail Worker deployed; metrics flowing to Analytics Engine; dashboards created

#### Story 6.6: Staging & Production Rollout
- **Effort**: 8 story points
- **Duration**: 1-2 days (DevOps)

Tasks:
- Set up staging environment (mirror of production)
- Perform smoke tests on staging (all endpoints, data validation)
- Create rollout plan (blue-green or canary deployment)
- Prepare rollback procedures
- Schedule go-live and monitor for 24 hours post-launch

**Acceptance**: Staging tests pass; rollout plan documented; post-launch monitoring 24h no issues

---

## Timeline & Milestones

### Phase 1: Backend Foundation (Week 1, Days 1-5)

**Milestone 1.1** (End of Day 2): Supabase RPCs defined and tested
- Epic 1.1 (User Engagement RPCs) ✓
- Story 1.1 complete: User engagement RPCs returning correct data

**Milestone 1.2** (End of Day 4): Content Performance RPCs + Cloudflare Worker skeleton
- Epic 1.2 (Content RPCs) ✓
- Epic 1.3 (Worker) 50% complete: Core aggregator structure in place

**Milestone 1.3** (End of Day 5): Worker aggregator fully functional with KV cache
- Epic 1.3 (Worker) 100% complete
- Epic 1.4 (D1 Metrics) 50% complete: Tail Worker deployed
- **Gate**: All aggregator tests passing; KV cache working

### Phase 2: API Layer (Week 1-2, Days 4-8)

**Milestone 2.1** (End of Day 6): Auth middleware + core endpoints deployed
- Epic 2.1 (Auth Middleware) ✓
- Epic 2.2 (Core API Routes) 50% complete: Dashboard, engagement, content endpoints live
- **Gate**: Rate limiting working; caching headers respected

**Milestone 2.2** (End of Day 8): All API endpoints complete with export functionality
- Epic 2.2 (Core Routes) 100% complete
- Epic 2.3 (Export Endpoints) 100% complete
- Epic 2.4 (Rate Limiting) 100% complete
- **Gate**: Integration tests pass; performance benchmarks meet targets

### Phase 3: Frontend UI (Week 2-3, Days 9-15)

**Milestone 3.1** (End of Day 11): Dashboard layout + core components (30% UI complete)
- Epic 3.1 (Dashboard Layout) ✓
- Epic 3.2 (Engagement Section) 50% complete
- **Gate**: Dashboard renders without errors; no console warnings

**Milestone 3.2** (End of Day 13): User engagement + content performance sections (60% UI complete)
- Epic 3.2 (Engagement Section) 100% complete
- Epic 3.3 (Content Section) 100% complete
- **Gate**: All sections render; data fetching working

**Milestone 3.3** (End of Day 15): All UI sections complete + optimization (100% UI complete)
- Epic 3.3 (Content Section) 100% complete
- Epic 3.4 (Infrastructure Section) 100% complete
- Epic 3.5 (Filters & Export) 100% complete
- Epic 3.6 (Optimization) 100% complete
- **Gate**: Lighthouse score >90; bundle <3MiB gzipped

### Phase 4: Testing & Launch (Week 3-4, Days 15-22)

**Milestone 4.1** (End of Day 17): Unit + integration tests complete (80% test coverage)
- Epic 5.1 (Backend Unit Tests) ✓
- Epic 5.2 (Integration Tests) ✓
- **Gate**: All tests pass; coverage >80%

**Milestone 4.2** (End of Day 19): Component + E2E tests complete
- Epic 5.3 (Frontend Component Tests) ✓
- Epic 5.5 (E2E Testing) 50% complete
- **Gate**: Component tests pass; E2E scenarios working in staging

**Milestone 4.3** (End of Day 21): Load testing + security audit (MVP Ready)
- Epic 5.4 (Load Testing) ✓
- Epic 5.5 (E2E Testing) 100% complete
- Epic 5.6 (Security Audit) ✓
- **Gate**: Performance targets met; security audit passes; no critical issues

**Milestone 4.4** (Day 22): Production Deployment
- Epic 6.1-6.6 (DevOps) ✓
- Blue-green deploy to production
- 24-hour monitoring period
- **Gate**: No production incidents; all metrics reporting correctly

### Critical Path Dependencies

```
├─ Epic 1.1-1.4 (Backend Aggregation) ──────────┐
│  └─ Epic 2.1-2.4 (API Routes) ────────────────┼──> Epic 5.1-5.6 (Testing) ──> Epic 6.1-6.6 (Deployment)
└─ Epic 3.1-3.6 (Frontend UI) ──────────────────┼──────────────────────────┘
   └─ Epic 4.1-4.2 (Data Fetching) ────────────┘
```

**Critical Path**: Backend Aggregation → API Routes → Frontend → Testing → Deployment
**Slack**: Frontend can start once API endpoints are defined (Day 4); testing can start once API deployed (Day 8)

---

## Sprint Breakdown (2-week sprints)

### Sprint 1: Supabase RPC + Server API (Days 1-10)

**Sprint Goal**: All backend APIs operational and ready for frontend integration

**Backlog**:
- Story 1.1: User Engagement RPCs (5 pts) — Backend Dev 1
- Story 1.2: Content Performance RPCs (5 pts) — Backend Dev 1
- Story 1.3: Cloudflare Worker Aggregator (7 pts) — Backend Dev 2
- Story 1.4: D1 Metrics Collection (3 pts) — DevOps
- Story 2.1: Auth Middleware (3 pts) — Backend Dev 1
- Story 2.2: Core API Routes (5 pts) — Backend Dev 2
- Story 5.1: Backend Unit Tests (5 pts) — Backend Dev 1 + QA

**Total**: 33 story points (4 developers, 2.5 points/day capacity = doable)

**Daily Standup Topics**:
- RPC performance (latency targets)
- Worker aggregator data freshness (KV cache TTL)
- API endpoint stability (error rates)
- Test coverage progress

**Sprint Gate**: All APIs operational; unit tests passing; staging environment working

### Sprint 2: Frontend UI + Data Fetching (Days 11-20)

**Sprint Goal**: Dashboard UI fully functional with data fetching

**Backlog**:
- Story 3.1: Dashboard Layout (5 pts) — Frontend Dev 1
- Story 3.2: Engagement Section (3 pts) — Frontend Dev 1
- Story 3.3: Content Section (5 pts) — Frontend Dev 2
- Story 3.4: Infrastructure Section (3 pts) — Frontend Dev 2
- Story 3.5: Filters & Export (3 pts) — Frontend Dev 1
- Story 3.6: Optimization (2 pts) — Frontend Dev 2
- Story 4.1: React Query Hooks (5 pts) — Frontend Dev 1
- Story 4.2: Real-time Updates (3 pts) — Frontend Dev 2
- Story 5.3: Frontend Component Tests (5 pts) — Frontend Dev 1 + QA

**Total**: 34 story points (2 developers, 3.4 points/day capacity = doable)

**Daily Standup Topics**:
- UI component render times
- Data fetching latency and caching effectiveness
- Bundle size growth
- Component test coverage

**Sprint Gate**: Dashboard fully functional; Lighthouse score >90; bundle <3MiB gzipped

### Sprint 3: Testing, Integration, Launch (Days 21-30)

**Sprint Goal**: Production-ready analytics dashboard deployed with zero incidents

**Backlog**:
- Story 2.3: Export Endpoints (5 pts) — Backend Dev 1
- Story 2.4: Rate Limiting (2 pts) — Backend Dev 2
- Story 5.2: Integration Tests (5 pts) — QA
- Story 5.4: Load Testing (3 pts) — QA + DevOps
- Story 5.5: E2E Testing (3 pts) — QA
- Story 5.6: Security Audit (2 pts) — QA + DevOps
- Story 6.1-6.5: DevOps Infrastructure (8 pts) — DevOps
- Story 6.6: Staging & Rollout (3 pts) — DevOps
- Bug fixes & polish (8 pts) — All

**Total**: 39 story points (distributed across all team members)

**Daily Standup Topics**:
- Test execution progress and pass rates
- Load test results and performance metrics
- Production rollout checklist completion
- Post-launch monitoring

**Sprint Gate**: All tests passing; security audit cleared; production deployment successful; 24-hour monitoring clean

---

## Risk Management

### Technical Risks

#### Risk 1: Supabase RPC Performance Degradation
- **Probability**: Medium
- **Impact**: High (dashboard loads slow, unusable)
- **Severity**: High
- **Mitigation**: 
  - Index all query tables upfront (story_views, story_likes, stories)
  - Load test RPCs with production data volume (simulate 1M+ records)
  - Implement RPC result caching in Workers KV (5-min TTL)
  - Set up query performance monitoring with alerts (>2s timeout)
  - Plan fallback: cache RPC results for 24h if DB goes down

#### Risk 2: Cloudflare Worker Cold Start Latency
- **Probability**: Medium
- **Impact**: Medium (dashboard load time >3s on cold start)
- **Severity**: Medium
- **Mitigation**:
  - Warm up Worker with scheduled pings (every 5 min)
  - Implement edge caching (Workers KV) to avoid repeated aggregation
  - Profile Worker initialization time in staging
  - Consider pre-warming KV cache on deployment

#### Risk 3: Frontend Bundle Size Exceeds 3MiB
- **Probability**: Medium
- **Impact**: Medium (page load slow, mobile users affected)
- **Severity**: Medium
- **Mitigation**:
  - Implement code splitting for analytics routes (lazy load)
  - Tree-shake unused dependencies (no charting library bloat)
  - Use dynamic imports for Chart.js/Recharts
  - Monitor bundle size in CI/CD pipeline (fail on >3MiB)
  - Pre-gzip and measure (target: <500KB analytics bundle impact)

#### Risk 4: D1 Metrics Collection Gaps
- **Probability**: Medium
- **Impact**: Low (infrastructure section shows incomplete data)
- **Severity**: Low
- **Mitigation**:
  - Start D1 instrumentation early (Tail Worker parallel to RPC dev)
  - Test Tail Worker with staging environment first
  - Have fallback: show "data unavailable" instead of stale data
  - Document manual query method for ad-hoc debugging

#### Risk 5: Role-Based Access Control Bypass
- **Probability**: Low
- **Impact**: Critical (data leak, security breach)
- **Severity**: Critical
- **Mitigation**:
  - Implement server-side auth checks on every API endpoint (no client trust)
  - Add security audit before launch (OWASP Top 10 review)
  - Test role-based filtering with test accounts (admin, employee, viewer)
  - Implement audit logging for all analytics access
  - Set up automated security scanning in CI/CD

### Scheduling Risks

#### Risk 6: Backend Dependencies Block Frontend
- **Probability**: Low
- **Impact**: Medium (frontend team idle)
- **Severity**: Medium
- **Mitigation**:
  - API contract defined by Day 2 (endpoint schemas, response formats)
  - Mock API responses for frontend development (decouple)
  - Frontend dev can start UI on Day 4 with mocked data
  - Gradual API integration testing (unit → integration → E2E)

#### Risk 7: Testing Phase Uncovers Major Issues
- **Probability**: Medium
- **Impact**: High (delays launch, pushes to Week 4)
- **Severity**: High
- **Mitigation**:
  - Start unit testing immediately after each story (not end of sprint)
  - Daily integration testing of new endpoints
  - Staging environment mirrors production by Day 10
  - Load testing run in parallel with QA (not sequential)
  - Time-box bug fixes: critical (fix immediately), high (24h), medium (sprint end)

#### Risk 8: Scope Creep During Development
- **Probability**: Medium
- **Impact**: Medium (timeline slips to Week 4+)
- **Severity**: Medium
- **Mitigation**:
  - Lock scope to MVP features by Day 1
  - Defer Phase 2 features (custom report builder, ML recommendations) to post-launch
  - Use "Cut scope" decision (not "add features") if behind schedule
  - Daily standup review for feature scope changes

### Performance Risks

#### Risk 9: Dashboard Load Time > 3 seconds
- **Probability**: Medium
- **Impact**: Medium (poor UX, users abandon)
- **Severity**: Medium
- **Mitigation**:
  - Monitor API latency targets: <200ms p95 (Day 5)
  - Implement skeleton screens for perceived performance
  - Use React Query SWR for stale-while-revalidate caching
  - Load test with slow network (3G throttling) early
  - Front-load metrics (show most important KPIs first)

#### Risk 10: Cache Invalidation Bugs (Stale Data)
- **Probability**: Low
- **Impact**: Medium (users see outdated metrics, makes wrong decisions)
- **Severity**: Medium
- **Mitigation**:
  - Implement explicit cache invalidation (manual refresh button)
  - Add cache metadata to response (generated_at, ttl_seconds)
  - Log cache hits/misses for debugging
  - Test cache behavior: trigger data change, verify refresh timing
  - Have fallback: show data freshness warning ("data from 10 min ago")

### Resource Risks

#### Risk 11: Key Developer Unavailable
- **Probability**: Low
- **Impact**: High (backend blocked if architect unavailable)
- **Severity**: High
- **Mitigation**:
  - Document architecture and RPC schemas (Day 2)
  - Pair programming on critical path items (Worker aggregator)
  - Cross-train second backend dev on RPC development
  - Keep code repository well-organized (clear file structure)

#### Risk 12: DevOps Bottleneck (Infrastructure Setup)
- **Probability**: Low
- **Impact**: Medium (delays launch by 2-3 days)
- **Severity**: Medium
- **Mitigation**:
  - Provision staging environment by Day 1
  - Use Infrastructure-as-Code (Terraform/Pulumi) for reproducibility
  - Pre-create Cloudflare Worker, KV namespace, Tail Worker
  - Have DevOps assist with Worker deployment (not wait until end)

---

## Resource Plan

### Team Composition

| Role | Count | Allocation | Responsibilities |
|------|-------|-----------|------------------|
| **Backend Dev (TypeScript)** | 2 | 100% | Supabase RPCs, Worker aggregator, API routes, unit tests |
| **Frontend Dev (React/TS)** | 2 | 100% | Dashboard UI, React Query hooks, component tests, optimization |
| **QA Engineer** | 1 | 100% | Integration tests, E2E tests, load testing, security audit |
| **DevOps/Infra** | 1 | 60% | Worker deployment, KV cache, monitoring, D1 instrumentation |
| **Product Manager** | 1 | 40% | Stakeholder communication, scope management, priority decisions |

**Total**: 6.4 FTE (2 backend, 2 frontend, 1 QA, 1 DevOps/0.6, 1 PM/0.4)

### Skill Requirements

| Skill | Required For | Team Member(s) |
|-------|--------------|-----------------|
| **Supabase/PostgreSQL** | RPC development, query optimization | Backend Dev 1 |
| **Cloudflare Workers/TypeScript** | Worker aggregator, KV cache | Backend Dev 2 |
| **Next.js / Server API routes** | API route implementation | Backend Dev 1 |
| **React / React Query** | Dashboard components, data fetching | Frontend Dev 1-2 |
| **Charting Libraries** (Recharts/Chart.js) | Data visualization | Frontend Dev 2 |
| **Testing Frameworks** (Vitest, RTL, Playwright) | Unit/integration/E2E tests | QA, Backend Dev 1 |
| **Cloudflare Infrastructure** | Worker deployment, monitoring | DevOps |
| **Performance Profiling** (Lighthouse, DevTools) | Bundle analysis, load testing | Frontend Dev 2, QA |
| **Security** (OWASP, JWT, RLS) | Auth implementation, audit | Backend Dev 1, QA |

### Staffing Schedule

```
Week 1-2 (Sprint 1):
  Backend Dev 1: Supabase RPCs (100%)
  Backend Dev 2: Cloudflare Worker + API routes (100%)
  Frontend Dev 1-2: Planning, mock API setup (25%)
  QA: Test planning, infrastructure setup (50%)
  DevOps: Staging environment setup (100%)

Week 2-3 (Sprint 2):
  Backend Dev 1-2: Bug fixes, rate limiting, export endpoints (50%)
  Frontend Dev 1-2: Dashboard UI, React Query (100%)
  QA: Integration testing, component tests (80%)
  DevOps: Monitoring setup, D1 instrumentation (80%)

Week 3-4 (Sprint 3):
  Backend Dev 1-2: Bug fixes, load test support (30%)
  Frontend Dev 1-2: Performance optimization, bug fixes (50%)
  QA: Load testing, E2E tests, security audit (100%)
  DevOps: Staging deployment, rollout preparation (100%)
  PM: Launch coordination, stakeholder updates (80%)
```

### Effort Estimates by Workstream

| Workstream | Total Story Points | Duration | Developers |
|------------|-------------------|----------|-----------|
| **Backend (RPC + API)** | 60 | 10 days | 2 backend devs |
| **Frontend (UI + Hooks)** | 40 | 10 days | 2 frontend devs |
| **Testing** | 45 | 8 days | 1 QA + support |
| **DevOps** | 25 | 6 days | 1 DevOps |
| **Total** | 170 | ~22 days | 6.4 FTE |

**Velocity Assumption**: 2.5-3.0 story points per developer per day

---

## Acceptance Criteria per Workstream

### Workstream 1: Supabase RPC Functions

| Acceptance Criterion | Validation Method | Owner |
|---------------------|-------------------|-------|
| All RPCs return data within 2 seconds | Load test with production data volume | QA |
| Results match manual SQL queries | Compare RPC output to hand-written queries | Backend Dev |
| Engagement RPCs: DAU, WAU, MAU, churn rate calculated correctly | Unit tests with known test data | Backend Dev |
| Content RPCs: Top stories/chapters ranked correctly | Unit tests verify sort order and limits | Backend Dev |
| Trending score RPC reflects engagement velocity | Manual calculation + RPC comparison | QA |
| Indexes applied for query optimization | Explain analyze plan shows index usage | DevOps |

### Workstream 2: Cloudflare Worker Aggregator

| Acceptance Criterion | Validation Method | Owner |
|---------------------|-------------------|-------|
| Worker returns complete dashboard JSON in <500ms | Monitor response times in staging | DevOps |
| Worker handles all 4 data sources (Supabase, R2, Analytics, D1) | Verify all fields present in response | QA |
| KV cache working (5-min TTL for 24h, 1h for 7d/30d) | Monitor cache hit ratio >90% | DevOps |
| Fallback responses for failed data sources (no 500 errors) | Simulate source failures, verify graceful degradation | QA |
| Worker error rate <0.1% under load | Load test 1000 req/s, measure errors | QA |

### Workstream 3: API Routes (Authentication & Authorization)

| Acceptance Criterion | Validation Method | Owner |
|---------------------|-------------------|-------|
| Unauthorized requests blocked (403 Forbidden) | Test without JWT token, verify rejection | QA |
| Role-based filtering works (admin sees all, employee sees own) | Test with multiple roles, verify data visibility | QA |
| Rate limiting enforced (100 req/min per user) | Simulate 101 requests, verify 429 response | QA |
| API responses include correct Cache-Control headers | Verify ETag and max-age in response | QA |
| Export endpoints generate correct CSV/PDF files | Generate sample export, validate format | QA |

### Workstream 4: Frontend Dashboard UI

| Acceptance Criterion | Validation Method | Owner |
|---------------------|-------------------|-------|
| Dashboard renders without errors or console warnings | Open in browser, check console | Frontend Dev |
| All interactive elements functional (filters, export, date picker) | Manual testing of each control | Frontend Dev |
| Responsive layout on desktop/tablet/mobile | Test on Chrome DevTools emulation | Frontend Dev |
| Lighthouse accessibility score >90 | Run Lighthouse audit | QA |
| Bundle size <3MiB gzipped (analytics module <500KB impact) | Run webpack-bundle-analyzer | Frontend Dev |
| Load time <2 seconds p95 on slow network (3G throttling) | Load test with Network throttling | QA |

### Workstream 5: React Query Data Fetching

| Acceptance Criterion | Validation Method | Owner |
|---------------------|-------------------|-------|
| Hooks return correct data matching API schema | Unit tests verify response structure | Frontend Dev |
| Caching working (stale-while-revalidate pattern) | Verify data freshness and cache hits | Frontend Dev |
| Refetch/invalidate working (manual + auto-refresh) | Test manual button and 5-min auto-refresh | QA |
| Error handling working (retry logic, user feedback) | Simulate API errors, verify retry behavior | QA |
| No console warnings or memory leaks | Run React DevTools Profiler | Frontend Dev |

### Workstream 6: Testing Coverage

| Acceptance Criterion | Validation Method | Owner |
|---------------------|-------------------|-------|
| Backend unit tests >80% coverage | Coverage report shows >80% | QA |
| Integration tests passing for all API endpoints | Run test suite, 100% pass rate | QA |
| Component tests passing for all dashboard sections | Run test suite, 100% pass rate | QA |
| E2E tests passing on staging (login → filter → export) | Run Playwright tests, 100% pass | QA |
| Load test passing: 1000 req/s to Worker, p95 <500ms | Load test report shows targets met | QA |
| Security audit findings remediated (no critical/high issues) | Security audit checklist signed off | QA |

### Workstream 7: DevOps & Launch

| Acceptance Criterion | Validation Method | Owner |
|---------------------|-------------------|-------|
| Worker deployed to production + staging | Verify deployment successful | DevOps |
| KV cache operational with correct TTL policies | Monitor cache metrics in Cloudflare dashboard | DevOps |
| Monitoring dashboards created and alerting active | Verify dashboards visible, test alert firing | DevOps |
| Tail Worker capturing D1 metrics correctly | Verify metrics in Analytics Engine | DevOps |
| Smoke tests passing on staging (24h pre-launch) | Run smoke test suite, 100% pass | QA |
| Rollback procedures documented and tested | Test rollback procedure, verify it works | DevOps |
| Zero production incidents in 24-hour post-launch window | Monitor logs, error rates, performance | DevOps |

---

## Assumptions & Constraints

### Assumptions
1. Supabase will remain stable (no migration required during development)
2. Cloudflare account has sufficient quota for Worker + KV usage
3. D1 instrumentation feasible without breaking backend-d1-saas service
4. Team members available full-time for 4 weeks (no context switching)
5. MVP scope locked (no major feature additions mid-sprint)

### Constraints
1. **Frontend bundle**: Must remain <3MiB gzipped (no bloat)
2. **Role-based access**: Strict RBAC enforced at API layer (no data leaks)
3. **Production outages**: Zero tolerance (blue-green deploy, smoke tests)
4. **Existing dashboard**: Cannot break admin operations during rollout
5. **API latency**: <200ms p95 (dashboard loads <2s)
6. **Data accuracy**: Within 5-10 minutes of real-time (acceptable lag)

---

## Deliverables

### End-of-Sprint Artifacts

**Sprint 1 (Day 10)**:
- ✅ Supabase RPC functions deployed to staging
- ✅ Cloudflare Worker aggregator deployed to staging
- ✅ Backend unit tests (>80% coverage)
- ✅ API integration tests passing
- ✅ Staging environment smoke tests passing

**Sprint 2 (Day 20)**:
- ✅ Dashboard UI fully functional in staging
- ✅ React Query hooks integrated
- ✅ Frontend component tests passing
- ✅ Bundle size validated (<3MiB)
- ✅ Load test results (targets met)

**Sprint 3 (Day 22)**:
- ✅ Production deployment complete
- ✅ Monitoring dashboards active
- ✅ Post-launch incident report (if any)
- ✅ User documentation (quick start guide for dashboard users)
- ✅ Handoff to Support team

### Documentation
- API endpoint documentation (Swagger/OpenAPI)
- RPC function documentation (parameters, response schema)
- React Query hook documentation (usage examples)
- Deployment runbook (staging + production procedures)
- Monitoring runbook (alerting, escalation procedures)
- Security audit report (OWASP compliance)

---

## Success Criteria

### Project Success
- ✅ MVP launched on schedule (Day 22)
- ✅ Zero production incidents in 24-hour post-launch window
- ✅ All acceptance criteria met
- ✅ Performance targets achieved (<2s dashboard load, p95)
- ✅ Test coverage >80%

### User Success
- ✅ Dashboard adopted by >80% of admin team within 2 weeks
- ✅ Average session duration >5 minutes
- ✅ User feedback: "actionable insights" rating >4/5
- ✅ Support tickets for dashboard <2/week

### Technical Success
- ✅ API uptime >99.9%
- ✅ Cache hit ratio >70%
- ✅ Worker error rate <0.1%
- ✅ Zero security vulnerabilities (audit passed)
