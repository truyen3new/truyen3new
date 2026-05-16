"use client";
import { useQuery } from '@tanstack/react-query';
import type { AnalyticsDashboardResponse, AnalyticsTimeRange } from '@/types/analytics';
import { apiClient } from '@/lib/apiClient';

/**
 * Hook: Fetch analytics dashboard data with React Query
 * Handles authentication, error boundaries, and caching
 */
export function useAnalyticsDashboardPresenter(
  timeRange: AnalyticsTimeRange = '7d',
  enabled: boolean = false,
  pollInterval: number = 0,
) {
  const dashboardQuery = useQuery({
    queryKey: ['analytics-dashboard', timeRange],
    enabled,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
    refetchInterval: pollInterval > 0 ? pollInterval : false,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<AnalyticsDashboardResponse> => {
      return apiClient.get<AnalyticsDashboardResponse>(`/api/admin/analytics/dashboard?range=${encodeURIComponent(timeRange)}`);
    },
  });

  return {
    dashboardQuery,
    data: dashboardQuery.data,
    isLoading: dashboardQuery.isLoading,
    error: dashboardQuery.error,
    refetch: dashboardQuery.refetch,
  };
}
