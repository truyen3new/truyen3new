import { AdminDashboardQueryGateway } from '@/infrastructure/query/AdminDashboardQueryGateway';
import { GetDashboardDataUseCase } from './GetDashboardDataUseCase';
import { GetOverviewMetricsUseCase } from './GetOverviewMetricsUseCase';

const dashboardGateway = new AdminDashboardQueryGateway();

export const getDashboardDataUseCase = new GetDashboardDataUseCase(dashboardGateway);
export const getOverviewMetricsUseCase = new GetOverviewMetricsUseCase(dashboardGateway);

export { GetDashboardDataUseCase } from './GetDashboardDataUseCase';
export { GetOverviewMetricsUseCase } from './GetOverviewMetricsUseCase';
export type { DashboardQueryGateway } from './GetDashboardDataUseCase';
export type { OverviewMetricsGateway } from './GetOverviewMetricsUseCase';
