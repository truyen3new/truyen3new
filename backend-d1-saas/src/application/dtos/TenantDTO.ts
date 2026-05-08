export interface CreateTenantRequest {
  slug: string;
  name: string;
  apiKey: string;
}

export interface TenantDTO {
  id: string;
  slug: string;
  name: string;
  databaseId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantResponse {
  success: boolean;
  tenant?: TenantDTO;
  databaseId?: string;
  error?: string;
}
