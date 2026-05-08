export type DashboardStatsDTO = {
  totalViews: number;
  activeStories: number;
  totalChapters: number;
};

export type DashboardDataDTO = {
  stories: Array<Record<string, unknown>>;
  stats: DashboardStatsDTO;
  syncedAt: string;
};

export type OverviewMetricsDTO = {
  profileCount: number;
  chapterCount: number;
  adSettingsCount: number;
  roleDistribution: Array<{ role: string; total: number }>;
};