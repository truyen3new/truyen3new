/**
 * Domain entity representing a tenant in the multi-tenant platform.
 * Contains business rules for tenant lifecycle.
 */
export class Tenant {
  private constructor(
    public readonly id: string,
    public readonly slug: string,
    public readonly name: string,
    public readonly databaseId: string,
    public readonly status: 'provisioning' | 'ready' | 'failed_bootstrap' | 'suspended',
    public readonly createdAt: Date,
  ) {}

  static create(id: string, slug: string, name: string, databaseId: string): Tenant {
    if (!slug.match(/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/)) {
      throw new Error('Tenant slug must be lowercase alphanumeric with hyphens');
    }

    if (name.trim().length === 0) {
      throw new Error('Tenant name is required');
    }

    return new Tenant(id, slug, name, databaseId, 'provisioning', new Date());
  }

  markReady(): Tenant {
    return new Tenant(this.id, this.slug, this.name, this.databaseId, 'ready', this.createdAt);
  }

  markFailedBootstrap(): Tenant {
    return new Tenant(this.id, this.slug, this.name, this.databaseId, 'failed_bootstrap', this.createdAt);
  }

  isProvisioning(): boolean {
    return this.status === 'provisioning';
  }

  isReady(): boolean {
    return this.status === 'ready';
  }
}
