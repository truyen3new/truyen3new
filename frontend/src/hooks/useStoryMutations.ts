'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOptimisticUpdate } from './useOptimisticUpdate';
import { apiClient } from '@/lib/apiClient';

/**
 * Hook for story-related mutations with optimistic updates.
 */
export const useStoryMutations = () => {
  const queryClient = useQueryClient();
  const { optimisticToggleLike, optimisticIncrementViews } = useOptimisticUpdate();

  /**
   * Mutation to increment a story's view count.
   */
  const useIncrementViewMutation = () => {
    return useMutation({
      mutationFn: async (storyId: string) => {
        await apiClient.post('/api/rpc/increment-story-views', { storyId });
      },
      onMutate: async (storyId) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['story', storyId] });
        // Apply optimistic update and return rollback function
        const rollback = optimisticIncrementViews(storyId);
        return { rollback };
      },
      onError: (_err, _storyId, context) => {
        if (context?.rollback) context.rollback();
      },
      onSettled: (_data, _error, storyId) => {
        queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      },
    });
  };

  /**
   * Mutation to toggle a story's like status.
   */
  const useLikeStoryMutation = () => {
    return useMutation({
      mutationFn: async ({ storyId, isCurrentlyLiked }: { storyId: string; isCurrentlyLiked: boolean }) => {
        await apiClient.post(`/api/rpc/${isCurrentlyLiked ? 'unlike-story' : 'like-story'}`, { storyId });
      },
      onMutate: async ({ storyId, isCurrentlyLiked }) => {
        await queryClient.cancelQueries({ queryKey: ['story', storyId] });
        const rollback = optimisticToggleLike(storyId, isCurrentlyLiked);
        return { rollback };
      },
      onError: (_err, { storyId: _storyId }, context) => {
        if (context?.rollback) context.rollback();
      },
      onSettled: (_data, _error, { storyId }) => {
        queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      },
    });
  };

  return {
    useIncrementViewMutation,
    useLikeStoryMutation,
  };
};
