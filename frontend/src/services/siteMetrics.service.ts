import { AdminDashboardQueryGateway } from '@/infrastructure/query/AdminDashboardQueryGateway';

const dashboardGateway = new AdminDashboardQueryGateway();

export async function getProfileCount(): Promise<number> {
  return dashboardGateway.loadOverviewMetrics().then((metrics) => metrics.profileCount);
}

export async function getChapterCount(): Promise<number> {
  return dashboardGateway.loadOverviewMetrics().then((metrics) => metrics.chapterCount);
}
