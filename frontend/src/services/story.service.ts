import { apiClient } from '@/lib/apiClient';

export async function fetchStories(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  const qs = searchParams.toString();
  return apiClient.get(`/api/stories${qs ? `?${qs}` : ''}`);
}

export async function fetchStoryById(id: string) {
  return apiClient.get(`/api/stories/${id}`);
}

export async function incrementViews(storyId: string) {
  return apiClient.post(`/api/rpc/increment-story-views`, { storyId });
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
