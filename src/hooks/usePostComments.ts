import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PostComment, CreateCommentInput } from '../types';
import { apiFetch } from '../utils/apiClient';
import { POSTS_QUERY_KEY, updatePost, snapshotPosts, restorePosts } from '../utils/postsCache';

export function usePostComments(postId: string | null) {
  const queryClient = useQueryClient();

  return useQuery<{ comments: PostComment[]; commentsCount?: number }>({
    queryKey: ['post-comments', postId],
    queryFn: async () => {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      const data = await apiFetch<{ comments: PostComment[]; commentsCount?: number }>(
        `/api/posts/${postId}/comments`
      );

      // ハイブリッド補正: 取得した最新の実数カウントをタイムライン投稿キャッシュに即時反映
      if (typeof data.commentsCount === 'number') {
        const actualCount = data.commentsCount;
        updatePost(queryClient, postId, (p) => ({ ...p, commentsCount: actualCount }));
      }

      return data;
    },
    enabled: !!postId,
    staleTime: 1000 * 60 * 2, // 2分間キャッシュ
  });
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      return apiFetch<{ comment: PostComment; commentsCount?: number }>(
        `/api/posts/${postId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );
    },
    onMutate: async (newCommentInput) => {
      await queryClient.cancelQueries({ queryKey: ['post-comments', postId] });
      await queryClient.cancelQueries({ queryKey: POSTS_QUERY_KEY });

      const previousComments = queryClient.getQueryData<{ comments: PostComment[] }>([
        'post-comments',
        postId,
      ]);
      const postsSnapshot = snapshotPosts(queryClient);

      // 楽観的更新（0秒で画面に反映）
      const optimisticComment: PostComment = {
        id: `optimistic-${Date.now()}`,
        discussionId: newCommentInput.discussionId || `disc-${Date.now()}`,
        text: newCommentInput.text,
        createdTime: new Date().toISOString(),
        createdBy: {
          id: 'me',
          name: '自分',
        },
        isOptimistic: true,
      };

      queryClient.setQueryData<{ comments: PostComment[] }>(['post-comments', postId], (old) => {
        const currentList = old?.comments || [];
        return {
          comments: [...currentList, optimisticComment],
        };
      });

      // タイムラインの投稿カード上のコメント数も即座に+1（楽観的インクリメント）
      updatePost(queryClient, postId, (p) => ({ ...p, commentsCount: (p.commentsCount || 0) + 1 }));

      return { previousComments, postsSnapshot };
    },
    onError: (_err, _newInput, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['post-comments', postId], context.previousComments);
      }
      if (context?.postsSnapshot) {
        restorePosts(queryClient, context.postsSnapshot);
      }
    },
    onSuccess: (data) => {
      if (typeof data.commentsCount === 'number') {
        const newCount = data.commentsCount;
        updatePost(queryClient, postId, (p) => ({ ...p, commentsCount: newCount }));
      }
    },
    // コメント一覧のみ再検証する（件数は onSuccess と一覧取得時の queryFn で投稿キャッシュへ反映済み）
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
    },
  });
}
