import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyticsDashboardResponse,
  AnalyticsRole,
  AnalyticsTimeRange,
  ContentPerformanceMetrics,
  InfrastructureMetrics,
  TopChapterMetric,
  UserEngagementMetrics,
} from '@/types/analytics';

type RpcRow = Record<string, unknown>;

type WorkerInfrastructurePayload = Partial<InfrastructureMetrics> & {
  recorded_at?: string;
};

type WorkerAnalyticsPayload = {
  infrastructure?: WorkerInfrastructurePayload;
  source_health?: Partial<AnalyticsDashboardResponse['meta']['source_health']>;
};

const DEFAULT_INFRASTRUCTURE: InfrastructureMetrics = {
  r2_usage_gb: 0,
  r2_allocated_gb: 0,
  r2_object_count: 0,
  r2_egress_gb: 0,
  d1_queries_count: 0,
  d1_avg_latency_ms: 0,
  page_views: 0,
  bandwidth_gb: 0,
  cache_hit_ratio_pct: 0,
  storage_efficiency_pct: 0,
};

const TIME_RANGE_TO_INTERVAL: Record<AnalyticsTimeRange, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

const TIME_RANGE_TO_LIMIT: Record<AnalyticsTimeRange, number> = {
  '24h': 5,
  '7d': 7,
  '30d': 10,
};

const TIME_RANGE_DAYS: Record<AnalyticsTimeRange, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

function createEmptyUserEngagement(): UserEngagementMetrics {
  return {
    total_users: 0,
    new_users: 0,
    active_users: 0,
    total_views: 0,
    total_favorites: 0,
    growth_rate_pct: 0,
    churn_rate_pct: 0,
    avg_session_duration_minutes: 0,
  };
}

function createEmptyContentPerformance(): ContentPerformanceMetrics {
  return {
    total_views: 0,
    total_favorites: 0,
    avg_views_per_chapter: 0,
    engagement_score: 0,
    top_chapters: [],
  };
}

export function normalizeAnalyticsTimeRange(value: string | null | undefined): AnalyticsTimeRange {
  if (value === '24h' || value === '7d' || value === '30d') return value;
  return '7d';
}

export function analyticsTimeRangeToInterval(range: AnalyticsTimeRange): string {
  return TIME_RANGE_TO_INTERVAL[range];
}

export function analyticsTimeRangeToLimit(range: AnalyticsTimeRange): number {
  return TIME_RANGE_TO_LIMIT[range];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function unwrapSingleRow<T extends RpcRow>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}

function computeGrowthRate(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return round(((current - previous) / previous) * 100);
}

function computeEfficiency(usedGb: number, allocatedGb: number): number {
  if (allocatedGb <= 0) return 0;
  return round((usedGb / allocatedGb) * 100);
}

function sanitizeTopChapters(value: unknown): TopChapterMetric[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      chapter_id: toString(row.chapter_id, crypto.randomUUID()),
      story_id: toString(row.story_id),
      title: toString(row.title, 'Untitled chapter'),
      chapter_number: Math.max(1, Math.trunc(toNumber(row.chapter_number, 1))),
      views: Math.max(0, Math.trunc(toNumber(row.views))),
      favorites: Math.max(0, Math.trunc(toNumber(row.favorites))),
      engagement_score: round(toNumber(row.engagement_score)),
      growth_rate_pct: round(toNumber(row.growth_rate_pct)),
    };
  });
}

async function fetchWorkerAnalytics(range: AnalyticsTimeRange, role: AnalyticsRole): Promise<WorkerAnalyticsPayload | null> {
  const workerUrl = process.env.CLOUDFLARE_ANALYTICS_WORKER_URL;
  if (!workerUrl) return null;

  const url = new URL(workerUrl);
  url.searchParams.set('range', range);
  url.searchParams.set('role', role);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) return null;
    return (await response.json()) as WorkerAnalyticsPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeInfrastructure(metrics: Partial<InfrastructureMetrics> | null | undefined): InfrastructureMetrics {
  if (!metrics) return { ...DEFAULT_INFRASTRUCTURE };

  const next: InfrastructureMetrics = {
    r2_usage_gb: round(toNumber(metrics.r2_usage_gb)),
    r2_allocated_gb: round(toNumber(metrics.r2_allocated_gb)),
    r2_object_count: Math.max(0, Math.trunc(toNumber(metrics.r2_object_count))),
    r2_egress_gb: round(toNumber(metrics.r2_egress_gb)),
    d1_queries_count: Math.max(0, Math.trunc(toNumber(metrics.d1_queries_count))),
    d1_avg_latency_ms: round(toNumber(metrics.d1_avg_latency_ms)),
    page_views: Math.max(0, Math.trunc(toNumber(metrics.page_views))),
    bandwidth_gb: round(toNumber(metrics.bandwidth_gb)),
    cache_hit_ratio_pct: round(toNumber(metrics.cache_hit_ratio_pct)),
    storage_efficiency_pct: round(toNumber(metrics.storage_efficiency_pct)),
  };

  if (next.storage_efficiency_pct === 0 && next.r2_allocated_gb > 0) {
    next.storage_efficiency_pct = computeEfficiency(next.r2_usage_gb, next.r2_allocated_gb);
  }

  return next;
}

async function fetchLatestStorageSnapshot(
  supabase: SupabaseClient,
  range: AnalyticsTimeRange,
): Promise<InfrastructureMetrics | null> {
  const { data, error } = await supabase
    .from('analytics_snapshots')
    .select('metrics')
    .eq('range_key', range)
    .eq('source', 'cloudflare')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeInfrastructure(data.metrics as Partial<InfrastructureMetrics> | null | undefined);
}

async function saveStorageSnapshot(
  supabase: SupabaseClient,
  range: AnalyticsTimeRange,
  metrics: InfrastructureMetrics,
): Promise<void> {
  try {
    await supabase.from('analytics_snapshots').insert({
      source: 'cloudflare',
      range_key: range,
      metrics,
    });
  } catch {
    // Best-effort cache only.
  }
}

async function fetchUserEngagement(
  supabase: SupabaseClient,
  range: AnalyticsTimeRange,
): Promise<UserEngagementMetrics> {
  const { data, error } = await supabase
    .rpc('get_user_engagement_metrics', {
      p_time_range: analyticsTimeRangeToInterval(range),
    })
    .single();

  if (error || !data) return createEmptyUserEngagement();

  const row = unwrapSingleRow(data as RpcRow | RpcRow[] | null);
  if (!row) return createEmptyUserEngagement();

  return {
    total_users: Math.max(0, Math.trunc(toNumber(row.total_users))),
    new_users: Math.max(0, Math.trunc(toNumber(row.new_users))),
    active_users: Math.max(0, Math.trunc(toNumber(row.active_users))),
    total_views: Math.max(0, Math.trunc(toNumber(row.total_views))),
    total_favorites: Math.max(0, Math.trunc(toNumber(row.total_favorites))),
    growth_rate_pct: round(toNumber(row.growth_rate_pct)),
    churn_rate_pct: round(toNumber(row.churn_rate_pct)),
    avg_session_duration_minutes: round(toNumber(row.avg_session_duration_minutes)),
  };
}

async function fetchContentPerformance(
  supabase: SupabaseClient,
  range: AnalyticsTimeRange,
  limit: number,
): Promise<ContentPerformanceMetrics> {
  const { data, error } = await supabase
    .rpc('get_content_performance', {
      p_time_range: analyticsTimeRangeToInterval(range),
      p_limit: limit,
    })
    .single();

  if (error || !data) return createEmptyContentPerformance();

  const row = unwrapSingleRow(data as RpcRow | RpcRow[] | null);
  if (!row) return createEmptyContentPerformance();

  return {
    total_views: Math.max(0, Math.trunc(toNumber(row.total_views))),
    total_favorites: Math.max(0, Math.trunc(toNumber(row.total_favorites))),
    avg_views_per_chapter: round(toNumber(row.avg_views_per_chapter)),
    engagement_score: round(toNumber(row.engagement_score)),
    top_chapters: sanitizeTopChapters(row.top_chapters),
  };
}

function applyRoleRestrictions(
  role: AnalyticsRole,
  userEngagement: UserEngagementMetrics,
  contentPerformance: ContentPerformanceMetrics,
  infrastructure: InfrastructureMetrics,
): {
  userEngagement: UserEngagementMetrics;
  contentPerformance: ContentPerformanceMetrics;
  infrastructure: InfrastructureMetrics;
  restricted: boolean;
} {
  if (role === 'superadmin' || role === 'admin') {
    return { userEngagement, contentPerformance, infrastructure, restricted: false };
  }

  return {
    userEngagement,
    contentPerformance: {
      ...contentPerformance,
      top_chapters: contentPerformance.top_chapters.slice(0, 3),
    },
    infrastructure: {
      ...infrastructure,
      r2_allocated_gb: 0,
      r2_object_count: 0,
      d1_queries_count: 0,
      d1_avg_latency_ms: 0,
    },
    restricted: true,
  };
}

export async function getAnalyticsDashboardData(params: {
  supabase: SupabaseClient;
  range: AnalyticsTimeRange;
  role: AnalyticsRole;
}): Promise<AnalyticsDashboardResponse> {
  const { supabase, range, role } = params;
  const now = new Date();
  const workerResult = await fetchWorkerAnalytics(range, role);

  const [userEngagement, contentPerformance, cachedInfrastructure] = await Promise.all([
    fetchUserEngagement(supabase, range),
    fetchContentPerformance(supabase, range, TIME_RANGE_TO_LIMIT[range]),
    fetchLatestStorageSnapshot(supabase, range),
  ]);

  const infrastructure = normalizeInfrastructure(workerResult?.infrastructure ?? cachedInfrastructure ?? DEFAULT_INFRASTRUCTURE);
  const restricted = applyRoleRestrictions(role, userEngagement, contentPerformance, infrastructure);

  if (workerResult?.infrastructure) {
    void saveStorageSnapshot(supabase, range, infrastructure);
  }

  return {
    meta: {
      timestamp: now.toISOString(),
      range,
      role,
      cached: !!cachedInfrastructure,
      restricted: restricted.restricted,
      source_health: {
        supabase: 'ready',
        cloudflare: workerResult?.infrastructure ? 'ready' : cachedInfrastructure ? 'degraded' : 'unavailable',
      },
      time_window: {
        start: new Date(now.getTime() - TIME_RANGE_DAYS[range] * 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString(),
        interval: analyticsTimeRangeToInterval(range),
      },
    },
    user_engagement: restricted.userEngagement,
    content_performance: restricted.contentPerformance,
    infrastructure: restricted.infrastructure,
    trends: {
      user_growth: [],
      traffic: [],
      storage: [],
    },
  };
}

export function computeGrowthRatePct(current: number, previous: number): number {
  return computeGrowthRate(current, previous);
}

export function computeStorageEfficiencyPct(usedGb: number, allocatedGb: number): number {
  return computeEfficiency(usedGb, allocatedGb);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatFixedNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
