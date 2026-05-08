import { BaseService } from '@/shared/core';
import type { DashboardDataDTO } from '../dtos/dashboard';

export interface DashboardQueryGateway {
  loadDashboardData(): Promise<DashboardDataDTO>;
}

export class GetDashboardDataUseCase extends BaseService {
  constructor(private readonly gateway: DashboardQueryGateway) {
    super('GetDashboardDataUseCase');
  }

  async execute(): Promise<DashboardDataDTO> {
    return this.executeOperation('get-dashboard-data', () => this.gateway.loadDashboardData());
  }
}