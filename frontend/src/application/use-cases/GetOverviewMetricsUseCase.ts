import { BaseService } from '@/shared/core';
import type { OverviewMetricsDTO } from '../dtos/dashboard';

export interface OverviewMetricsGateway {
  loadOverviewMetrics(): Promise<OverviewMetricsDTO>;
}

export class GetOverviewMetricsUseCase extends BaseService {
  constructor(private readonly gateway: OverviewMetricsGateway) {
    super('GetOverviewMetricsUseCase');
  }

  async execute(): Promise<OverviewMetricsDTO> {
    return this.executeOperation('get-overview-metrics', () => this.gateway.loadOverviewMetrics());
  }
}