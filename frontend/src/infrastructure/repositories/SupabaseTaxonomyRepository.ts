import { Category } from '@/types/entities';
import { apiClient } from '@/lib/apiClient';

export class SupabaseTaxonomyRepository {
  async getCategories(): Promise<Category[]> {
    return apiClient.get<Category[]>('/api/admin/taxonomy?entity=category');
  }

  async getCategoryById(id: string): Promise<Category | null> {
    const rows = await apiClient.get<Category[]>('/api/admin/taxonomy?entity=category');
    return rows.find((row) => row.id === id) ?? null;
  }

  async createCategory(payload: { name: string; description?: string | null }) {
    return apiClient.post('/api/admin/taxonomy', { entity: 'category', action: 'create', payload });
  }

  async updateCategory(id: string, payload: { name: string; description?: string | null }) {
    return apiClient.post('/api/admin/taxonomy', { entity: 'category', action: 'update', id, payload });
  }

  async deleteCategory(id: string) {
    return apiClient.post('/api/admin/taxonomy', { entity: 'category', action: 'delete', id });
  }

  async getAuthors(): Promise<any[]> {
    return apiClient.get<any[]>('/api/admin/taxonomy?entity=author');
  }

  async createAuthor(payload: { name: string; bio?: string | null }): Promise<any> {
    return apiClient.post('/api/admin/taxonomy', { entity: 'author', action: 'create', payload });
  }

  async updateAuthor(id: string, payload: { name: string; bio?: string | null }): Promise<any> {
    return apiClient.post('/api/admin/taxonomy', { entity: 'author', action: 'update', id, payload });
  }

  async deleteAuthor(id: string): Promise<void> {
    return apiClient.post('/api/admin/taxonomy', { entity: 'author', action: 'delete', id });
  }
}
