import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/apiClient';

export function usePostBlocks(postId: string | null) {
  return useQuery<{ markdown: string; url: string }>({
    queryKey: ['post-blocks', postId],
    queryFn: async () => {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      return apiFetch<{ markdown: string; url: string }>(`/api/posts/${postId}/blocks`);
    },
    enabled: !!postId,
    staleTime: 1000 * 60 * 5, // 5分間キャッシュ
  });
}
