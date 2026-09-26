import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PostComment, CreateCommentInput, Post } from '../types';
import { apiFetch } from '../utils/apiClient';

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
        queryClient.setQueryData<{ posts: Post[] }>(['posts'], (old) => {
          if (!old) return old;
          return {
            posts: old.posts.map((p) =>
              p.id === postId ? { ...p, commentsCount: actualCount } : p
            ),
          };
        });
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
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      const previousComments = queryClient.getQueryData<{ comments: PostComment[] }>([
        'post-comments',
        postId,
      ]);
      const previousPosts = queryClient.getQueryData<{ posts: Post[] }>(['posts']);

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
      if (previousPosts) {
        queryClient.setQueryData<{ posts: Post[] }>(['posts'], {
          posts: previousPosts.posts.map((p) =>
            p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
          ),
        });
      }

      return { previousComments, previousPosts };
    },
    onError: (_err, _newInput, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['post-comments', postId], context.previousComments);
      }
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts);
      }
    },
    onSuccess: (data) => {
      if (typeof data.commentsCount === 'number') {
        const newCount = data.commentsCount;
        queryClient.setQueryData<{ posts: Post[] }>(['posts'], (old) => {
          if (!old) return old;
          return {
            posts: old.posts.map((p) =>
              p.id === postId ? { ...p, commentsCount: newCount } : p
            ),
          };
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
