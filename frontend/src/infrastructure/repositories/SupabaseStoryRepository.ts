import { Story } from '@/types/entities';
import { IStoryRepository } from '@/domain/interfaces';
import { supabase } from '@/infrastructure/supabase/client';
import { apiClient } from '@/lib/apiClient';

type StoryStatus = Story['status'];

type StoryPageParams = {
  page: number;
  pageSize: number;
  keyword?: string;
  category?: 'all' | string;
  status?: 'all' | StoryStatus;
  sort?: 'newest' | 'oldest' | 'most_viewed';
};

type StoryPageResult = {
  items: Story[];
  total: number;
};

export class SupabaseStoryRepository implements IStoryRepository {
  async getStories(): Promise<Story[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('stories')
      .select('id,title,author,author_id,description,cover_url,category,category_id,status,views,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return [];
    return (data ?? []) as Story[];
  }

  async getStoryById(id: string): Promise<Story | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('stories')
      .select('id,title,author,author_id,description,cover_url,category,category_id,status,views,created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) return null;
    return (data ?? null) as Story | null;
  }

  async incrementViews(storyId: string): Promise<void> {
    await apiClient.post('/api/rpc/increment-story-views', { storyId });
  }

  async saveStory(story: Partial<Story>): Promise<Story> {
    const result = await apiClient.post<{ story: Story }>('/api/admin/manage-story', { story });
    if (!result.story) throw new Error('Story was created but the server did not return the record');
    return result.story;
  }

  async getStoriesPage(params: StoryPageParams): Promise<StoryPageResult> {
    if (!supabase) return { items: [], total: 0 };
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 10));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('stories')
      .select('id,title,author,author_id,description,cover_url,category,category_id,status,views,created_at', { count: 'exact' });
    if (params.keyword) {
      const escaped = params.keyword.replace(/[%_]/g, (match) => `\\${match}`);
      query = query.or(
        `title.ilike.%${escaped}%,author.ilike.%${escaped}%,category.ilike.%${escaped}%,description.ilike.%${escaped}%`,
      );
    }
    if (params.category && params.category !== 'all') {
      query = query.ilike('category', `%${params.category}%`);
    }
    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }
    if (params.sort === 'oldest') query = query.order('created_at', { ascending: true });
    else if (params.sort === 'most_viewed') query = query.order('views', { ascending: false, nullsFirst: false });
    else query = query.order('created_at', { ascending: false });
    const { data, error, count } = await query.range(from, to);
    if (error) return { items: [], total: 0 };
    return { items: (data ?? []) as Story[], total: count ?? 0 };
  }

  async updateStory(id: string, payload: Pick<Story, 'title' | 'description' | 'status'>): Promise<Story> {
    const result = await apiClient.post<{ story: Story }>('/api/admin/manage-story', { action: 'update', id, payload });
    if (!result.story) throw new Error('Update failed');
    return result.story;
  }

  async deleteStory(id: string): Promise<void> {
    await apiClient.post('/api/admin/manage-story', { action: 'delete', id });
  }

  async bulkUpdateStatus(ids: string[], status: Story['status']): Promise<void> {
    await apiClient.post('/api/admin/manage-story', { action: 'bulkUpdateStatus', ids, status });
  }

  async bulkDeleteStories(ids: string[]): Promise<void> {
    await apiClient.post('/api/admin/manage-story', { action: 'bulkDelete', ids });
  }
}
