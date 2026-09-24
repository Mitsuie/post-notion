import { useQuery } from '@tanstack/react-query';

export function usePostBlocks(postId: string | null) {
  return useQuery<{ markdown: string; url: string }>({
    queryKey: ['post-blocks', postId],
    queryFn: async () => {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      const res = await fetch(`/api/posts/${postId}/blocks`);
      if (!res.ok) {
        throw new Error('本文の取得に失敗しました');
      }
      return res.json();
    },
    enabled: !!postId,
    staleTime: 1000 * 60 * 5, // 5分間キャッシュ
  });
}
