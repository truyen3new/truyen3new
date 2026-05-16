import { useQuery } from "@tanstack/react-query";
import { apiClient } from '@/lib/apiClient';

export const useChapterDetail = (chapterId: string) => {
  return useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: async () => {
      if (!chapterId) return null;
      return apiClient.get(`/api/chapters?id=${chapterId}`);
    },
    enabled: !!chapterId,
    staleTime: 1000 * 60 * 60,
  });
};
