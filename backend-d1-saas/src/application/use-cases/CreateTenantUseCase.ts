import { DomainError } from '../../shared/core';
import { CreateTenantRequest, CreateTenantResponse } from '../dtos/TenantDTO';

/**
 * Application-layer use case for tenant provisioning.
 * Orchestrates domain logic, infrastructure calls, and error handling.
 */
export class CreateTenantUseCase {
  constructor(
    private readonly provisioningClient: any,
    private readonly controlRepository: any,
    private readonly cloudflareClient: any,
  ) {}

  async execute(request: CreateTenantRequest): Promise<CreateTenantResponse> {
    const tenantId = this.generateId();
    const databaseName = this.buildDatabaseName(request.slug, tenantId);

    try {
      // Delegate to provisioning client which handles rollback/recovery
      const result = await this.provisioningClient.provisionWithRollback(
        tenantId,
        request.slug,
        request.name,
        databaseName,
        await this.hashApiKey(request.apiKey),
      );

      if (!result.success) {
        throw new DomainError(result.error || 'Provisioning failed', 'PROVISIONING_FAILED', 500);
      }

      // Fetch the created tenant record
      const tenantRecord = await this.controlRepository.getTenantById(tenantId);
      if (!tenantRecord) {
        throw new DomainError('Tenant not found after provisioning', 'NOT_FOUND', 500);
      }

      return {
        success: true,
        tenant: this.mapToDTO(tenantRecord),
        databaseId: result.databaseId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during provisioning';
      return {
        success: false,
        error: message,
      };
    }
  }

  private generateId(): string {
    return `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private buildDatabaseName(slug: string, tenantId: string): string {
    return `tenant-${slug}-${tenantId.slice(0, 8)}`;
  }

  private async hashApiKey(apiKey: string): Promise<string> {
    const encoded = new TextEncoder().encode(apiKey);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private mapToDTO(row: any) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      databaseId: row.database_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
