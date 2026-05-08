"use client";

import { useQuery } from '@tanstack/react-query';
import type { AnalyticsDashboardResponse, AnalyticsTimeRange } from '@/types/analytics';
import { supabase } from '@/lib/supabase/client';

function createFallbackAnalyticsDashboard(range: AnalyticsTimeRange): AnalyticsDashboardResponse {
  const now = new Date().toISOString();

  return {
    meta: {
      timestamp: now,
      range,
      role: 'employee',
      cached: false,
      restricted: true,
      source_health: {
        supabase: 'unavailable',
        cloudflare: 'degraded',
      },
      time_window: {
        start: now,
        end: now,
        interval: range === '24h' ? '24 hours' : range === '30d' ? '30 days' : '7 days',
      },
    },
    user_engagement: {
      total_users: 0,
      new_users: 0,
      active_users: 0,
      total_views: 0,
      total_favorites: 0,
      growth_rate_pct: 0,
      churn_rate_pct: 0,
      avg_session_duration_minutes: 0,
    },
    content_performance: {
      total_views: 0,
      total_favorites: 0,
      avg_views_per_chapter: 0,
      engagement_score: 0,
      top_chapters: [] as AnalyticsDashboardResponse['content_performance']['top_chapters'],
    },
    infrastructure: {
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
      device_mobile: 0,
      device_desktop: 0,
      device_tablet: 0,
      top_zones: [],
    },
    trends: {
      user_growth: [],
      traffic: [],
      storage: [],
    },
  };
}

async function fetchAnalyticsDashboard(range: AnalyticsTimeRange): Promise<AnalyticsDashboardResponse> {
  let accessToken: string | null = null;

  try {
    if (supabase) {
      const sessionResult = await supabase.auth.getSession();
      accessToken = sessionResult.data.session?.access_token ?? null;
    }
  } catch {
    accessToken = null;
  }

  try {
    const response = await fetch(`/api/internal/admin/analytics/dashboard?range=${encodeURIComponent(range)}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return createFallbackAnalyticsDashboard(range);
    }

    const payload = (await response.json().catch(() => null)) as AnalyticsDashboardResponse | null;
    return payload ?? createFallbackAnalyticsDashboard(range);
  } catch {
    return createFallbackAnalyticsDashboard(range);
  }
}

export function useAnalyticsDashboard(timeRange: AnalyticsTimeRange) {
  return useQuery({
    queryKey: ['analytics-dashboard', timeRange],
    queryFn: () => fetchAnalyticsDashboard(timeRange),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: timeRange === '24h' ? 5 * 60_000 : timeRange === '7d' ? 15 * 60_000 : 30 * 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}
