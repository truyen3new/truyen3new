import type { DashboardDataDTO, OverviewMetricsDTO } from '@/application/dtos/dashboard';
import type { DashboardQueryGateway } from '@/application/use-cases/GetDashboardDataUseCase';
import type { OverviewMetricsGateway } from '@/application/use-cases/GetOverviewMetricsUseCase';
import { apiClient } from '@/lib/apiClient';

function emptyDashboardData(): DashboardDataDTO {
  return {
    stories: [],
    stats: { totalViews: 0, activeStories: 0, totalChapters: 0 },
    syncedAt: new Date().toISOString(),
  };
}

function err(msg: string): void {
  if (process.env.NODE_ENV === 'development') console.warn('[AdminDashboardQueryGateway]', msg);
}

export class AdminDashboardQueryGateway implements DashboardQueryGateway, OverviewMetricsGateway {
  async loadDashboardData(): Promise<DashboardDataDTO> {
    try {
      const data = await apiClient.get<{
        stories?: Array<Record<string, unknown>>;
        stats?: { totalStories?: number; totalChapters?: number; activeStories?: number; totalViews?: number };
      }>('/api/admin/analytics/dashboard?range=7d');

      const stories = Array.isArray(data?.stories) ? data.stories : [];
      const totalViews = Number(data?.stats?.totalViews ?? stories.reduce((sum: number, s: any) => sum + (Number(s.views) || 0), 0));
      const activeStories = Number(data?.stats?.activeStories ?? 0);
      const totalChapters = Number(data?.stats?.totalChapters ?? 0);

      return {
        stories,
        stats: { totalViews, activeStories, totalChapters },
        syncedAt: new Date().toISOString(),
      };
    } catch (e) {
      err(`loadDashboardData failed: ${e}`);
      return emptyDashboardData();
    }
  }

  async loadOverviewMetrics(): Promise<OverviewMetricsDTO> {
    try {
      const [profileCountRes, chapterCountRes, adSettingsCountRes, roleDistributionRes] = await Promise.all([
        apiClient.get<{ count?: number }>('/api/admin/site-metrics?type=profiles'),
        apiClient.get<{ count?: number }>('/api/admin/site-metrics?type=chapters'),
        apiClient.get<{ count?: number }>('/api/admin/site-metrics?type=site-settings'),
        apiClient.get<Array<{ role: string; total: number }>>('/api/admin/role-distribution'),
      ]);

      const roleDistribution = Array.isArray(roleDistributionRes) ? roleDistributionRes : [];

      return {
        profileCount: Number(profileCountRes?.count ?? 0),
        chapterCount: Number(chapterCountRes?.count ?? 0),
        adSettingsCount: Number(adSettingsCountRes?.count ?? 0),
        roleDistribution,
      };
    } catch (e) {
      err(`loadOverviewMetrics failed: ${e}`);
      return { profileCount: 0, chapterCount: 0, adSettingsCount: 0, roleDistribution: [] };
    }
  }
}