import { Category } from '@/types/entities';
import { supabase } from '@/infrastructure/supabase/client';
import { apiClient } from '@/lib/apiClient';

export class SupabaseTaxonomyRepository {
  async getCategories(): Promise<Category[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('categories')
      .select('id,name,description,created_at,updated_at')
      .order('name', { ascending: true });
    if (error) return [];
    return (data ?? []) as Category[];
  }

  async getCategoryById(id: string): Promise<Category | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('categories')
      .select('id,name,description,created_at,updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) return null;
    return (data ?? null) as Category | null;
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
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('authors')
      .select('id,name,bio,created_at,updated_at')
      .order('name', { ascending: true });
    if (error) return [];
    return (data ?? []) as any[];
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
