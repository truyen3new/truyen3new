import { ITenantRepository } from './ITenantRepository';
import { Tenant } from '../../core/entities/Tenant';
import { BaseRepository } from '../../shared/core';

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  database_id: string;
  database_name: string;
  api_key_hash: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run<T = Record<string, unknown>>(): Promise<T>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

/**
 * Adapter: D1 database implementation of ITenantRepository.
 */
export class D1TenantRepository extends BaseRepository<Tenant, string> implements ITenantRepository {
  constructor(private readonly db: D1Database) {
    super('D1TenantRepository');
  }

  async create(tenant: Tenant, apiKeyHash: string): Promise<void> {
    await this.execute('create', async () => {
      await this.db
        .prepare(
          `INSERT INTO tenants (id, slug, name, database_id, database_name, api_key_hash, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          tenant.id,
          tenant.slug,
          tenant.name,
          tenant.databaseId,
          `tenant-${tenant.slug}-${tenant.id.slice(0, 8)}`,
          apiKeyHash,
          tenant.status,
        )
        .run();
    });
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.execute('findById', async () => {
      const row = await this.db
        .prepare(
          `SELECT id, slug, name, database_id, database_name, api_key_hash, status, created_at, updated_at 
           FROM tenants WHERE id = ? LIMIT 1`
        )
        .bind(id)
        .first<TenantRow>();

      if (!row) return null;
      return this.mapToDomain(row);
    });
  }

  async list(): Promise<Tenant[]> {
    return this.execute('list', async () => {
      const result = await this.db
        .prepare(
          `SELECT id, slug, name, database_id, database_name, api_key_hash, status, created_at, updated_at 
           FROM tenants ORDER BY created_at DESC`
        )
        .all<TenantRow>();

      return result.results.map((row) => this.mapToDomain(row));
    });
  }

  async markReady(id: string): Promise<void> {
    await this.execute('markReady', async () => {
      await this.db
        .prepare(`UPDATE tenants SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(id)
        .run();
    });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.execute('updateStatus', async () => {
      await this.db
        .prepare(`UPDATE tenants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(status, id)
        .run();
    });
  }

  // BaseRepository abstract methods (unused in this adapter but required by interface)
  async delete(id: string): Promise<void> {
    await this.execute('delete', async () => {
      await this.db.prepare(`DELETE FROM tenants WHERE id = ?`).bind(id).run();
    });
  }

  async save(entity: Tenant): Promise<void> {
    // Update existing tenant record
    await this.execute('save', async () => {
      await this.db
        .prepare(
          `UPDATE tenants SET slug = ?, name = ?, database_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
        .bind(entity.slug, entity.name, entity.databaseId, entity.status, entity.id)
        .run();
    });
  }

  private mapToDomain(row: TenantRow): Tenant {
    return Tenant.create(row.id, row.slug, row.name, row.database_id);
  }
}
