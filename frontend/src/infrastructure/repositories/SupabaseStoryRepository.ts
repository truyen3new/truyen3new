import { Story } from '@/types/entities';
import { IStoryRepository } from '@/domain/interfaces';
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

type StoryListResponse = Story[] | { items: Story[] };

export class SupabaseStoryRepository implements IStoryRepository {
  async getStories(): Promise<Story[]> {
    const result = await apiClient.get<StoryListResponse>('/api/stories');
    return Array.isArray(result) ? result : result.items;
  }

  async getStoryById(id: string): Promise<Story | null> {
    return apiClient.get<Story>(`/api/stories/${id}`);
  }

  async incrementViews(storyId: string): Promise<void> {
    await apiClient.post('/api/stories/views', { storyId });
  }

  async saveStory(story: Partial<Story>): Promise<Story> {
    const result = await apiClient.post<Story[] | { story: Story }>('/api/admin/manage-story', { story });
    const created = Array.isArray(result) ? result[0] : result.story;
    if (!created) throw new Error('Story was created but the server did not return the record');
    return created;
  }

  async getStoriesPage(params: StoryPageParams): Promise<StoryPageResult> {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(Math.max(1, params.page ?? 1)));
    searchParams.set('pageSize', String(Math.min(50, Math.max(1, params.pageSize ?? 10))));
    if (params.keyword) searchParams.set('keyword', params.keyword);
    if (params.category && params.category !== 'all') searchParams.set('category', params.category);
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.sort) searchParams.set('sort', params.sort);

    const result = await apiClient.get<StoryListResponse>(`/api/stories?${searchParams.toString()}`);
    const items = Array.isArray(result) ? result : result.items;
    return { items, total: items.length };
  }

  async updateStory(id: string, payload: Pick<Story, 'title' | 'description' | 'status'>): Promise<Story> {
    const result = await apiClient.post<Story[] | { story: Story }>('/api/admin/manage-story', { action: 'update', id, payload });
    const updated = Array.isArray(result) ? result[0] : result.story;
    if (!updated) throw new Error('Update failed');
    return updated;
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
