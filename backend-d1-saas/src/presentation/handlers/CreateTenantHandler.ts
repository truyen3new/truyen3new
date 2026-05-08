import { CreateTenantUseCase } from '../../application/use-cases';
import type { CreateTenantRequest } from '../../application/dtos';
import { CloudflareD1AdminClient } from '../../infrastructure/clients';
import { D1TenantRepository } from '../../infrastructure/repositories/D1TenantRepository';
import { createJsonResponse, withGlobalExceptionHandling } from '../../shared/core';

/**
 * Presentation layer handler: Factory to wire up use cases.
 * This shows how handlers are created with all dependencies injected.
 * 
 * NOTE: This is a template/example. The provisioning client implementation
 * should be created once the full provisioning workflow is specified.
 */
export function createTenantHandler(
  controlDb: any, // D1Database
  env: any, // Worker environment
) {
  // Wire infrastructure
  const tenantRepository = new D1TenantRepository(controlDb);
  const cloudflareClient = new CloudflareD1AdminClient(env.CF_ACCOUNT_ID, env.CF_API_TOKEN);
  
  // NOTE: TransactionalProvisioningClient would be wired here once implemented
  // const provisioningClient = new TransactionalProvisioningClient(env, controlDb, cloudflareClient);

  // Wire use case
  // const createTenantUseCase = new CreateTenantUseCase(
  //   provisioningClient,
  //   tenantRepository,
  //   cloudflareClient,
  // );

  // Return wrapped handler
  return withGlobalExceptionHandling(
    async (request: Request) => {
      if (request.method !== 'POST') {
        return createJsonResponse({ error: 'Method not allowed' }, 405);
      }

      const body = (await request.json()) as CreateTenantRequest;

      // Use case execution would happen here once provisioning is implemented
      // const result = await createTenantUseCase.execute(body);
      
      // Placeholder response
      const result = {
        success: false,
        error: 'Provisioning service not yet implemented',
      };

      if (!result.success) {
        return createJsonResponse({ error: result.error }, 500);
      }

      return createJsonResponse(result, 201);
    },
  );
}
