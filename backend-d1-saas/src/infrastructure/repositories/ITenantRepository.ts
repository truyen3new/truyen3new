import { Tenant } from '../../core/entities/Tenant';

/**
 * Port: Tenant repository interface.
 * Infrastructure implementations (adapters) must satisfy this contract.
 */
export interface ITenantRepository {
  create(tenant: Tenant, apiKeyHash: string): Promise<void>;
  findById(id: string): Promise<Tenant | null>;
  list(): Promise<Tenant[]>;
  markReady(id: string): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
}

/**
 * Port: Cloudflare D1 API client interface.
 */
export interface ICloudflareClient {
  createDatabase(name: string): Promise<{ id: string; name: string }>;
  bootstrapDatabase(databaseId: string): Promise<void>;
  query(databaseId: string, sql: string, params?: unknown[]): Promise<unknown>;
}

/**
 * Port: Provisioning service interface.
 */
export interface IProvisioningService {
  provisionWithRollback(
    tenantId: string,
    tenantSlug: string,
    tenantName: string,
    databaseName: string,
    apiKeyHash: string,
  ): Promise<{ success: boolean; databaseId?: string; error?: string }>;
  rollbackTenant(tenantId: string): Promise<void>;
}
