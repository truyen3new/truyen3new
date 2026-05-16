import type { DashboardDataDTO, OverviewMetricsDTO } from '@/application/dtos/dashboard';
import type { DashboardQueryGateway } from '@/application/use-cases/GetDashboardDataUseCase';
import type { OverviewMetricsGateway } from '@/application/use-cases/GetOverviewMetricsUseCase';

function emptyDashboardData(): DashboardDataDTO {
  return {
    stories: [],
    stats: { totalViews: 0, activeStories: 0, totalChapters: 0 },
    syncedAt: new Date().toISOString(),
  };
}

export class AdminDashboardQueryGateway implements DashboardQueryGateway, OverviewMetricsGateway {
  async loadDashboardData(): Promise<DashboardDataDTO> {
    return emptyDashboardData();
  }

  async loadOverviewMetrics(): Promise<OverviewMetricsDTO> {
    return {
      profileCount: 0,
      chapterCount: 0,
      adSettingsCount: 0,
      roleDistribution: [],
    };
  }
}