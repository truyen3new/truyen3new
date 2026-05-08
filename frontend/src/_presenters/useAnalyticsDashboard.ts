"use client";

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AnalyticsDashboardResponse, AnalyticsTimeRange } from '@/types/analytics';

async function fetchAnalyticsDashboard(range: AnalyticsTimeRange): Promise<AnalyticsDashboardResponse> {
  const response = await fetch(`/api/internal/admin/analytics/dashboard?range=${encodeURIComponent(range)}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as AnalyticsDashboardResponse | { error?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && payload.error
      ? payload.error
      : `Failed to load analytics dashboard (${response.status})`;
    throw new Error(message);
  }

  return payload as AnalyticsDashboardResponse;
}

export function useAnalyticsDashboard(timeRange: AnalyticsTimeRange) {
  const accessLoggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (accessLoggedRef.current === timeRange) return;
    accessLoggedRef.current = timeRange;

    void fetch('/api/internal/admin/audit', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'dashboard_access',
        metadata: {
          page: '/admin',
          surface: 'analytics_overview',
          time_range: timeRange,
        },
      }),
    }).catch(() => undefined);
  }, [timeRange]);

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
