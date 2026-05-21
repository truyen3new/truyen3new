import { Story } from '@/types/entities';
import { apiClient } from '@/lib/apiClient';

type StoryListResponse = Story[] | { items: Story[] };

export async function fetchStories(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}): Promise<StoryListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  const qs = searchParams.toString();
  return apiClient.get<StoryListResponse>(`/api/stories${qs ? `?${qs}` : ''}`);
}

export async function fetchStoryById(id: string) {
  return apiClient.get<Story>(`/api/stories/${id}`);
}

export async function incrementViews(storyId: string) {
  return apiClient.post(`/api/stories/views`, { storyId });
}

export async function saveStory(story: Partial<any>) {
  return apiClient.post(`/api/stories`, story);
}

export default {
  fetchStories,
  fetchStoryById,
  incrementViews,
  saveStory,
};
