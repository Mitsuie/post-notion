import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Post, CreatePostInput } from '../types';

export function usePosts() {
  const queryClient = useQueryClient();

  // タイムライン一覧取得
  const postsQuery = useQuery<{ posts: Post[] }>({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await fetch('/api/posts');
      if (!res.ok) {
        throw new Error('投稿一覧の取得に失敗しました');
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5分間キャッシュ
  });

  // 楽観的UI更新付きの新規投稿
  const createPostMutation = useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || '投稿の作成に失敗しました');
      }
      return res.json();
    },
    // 楽観的更新: 送信直後に仮データをタイムライン先頭へ挿入
    onMutate: async (newPostInput) => {
      // 進行中のフェッチをキャンセル
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // 前の状態をスナップショット保存
      const previousData = queryClient.getQueryData<{ posts: Post[] }>(['posts']);

      if (previousData) {
        const tempId = `temp-${Date.now()}`;
        const optimisticPost: Post = {
          id: tempId,
          title: newPostInput.title,
          createdTime: new Date().toISOString(),
          createdBy: {
            id: 'current-user',
            name: 'あなた',
          },
          tags: (newPostInput.tagIds || []).map((id) => ({ id })),
          pinned: !!newPostInput.pinned,
          commentsCount: 0,
          isOptimistic: true, // 送信中フラグ
        };

        // ピン止めを考慮してタイムライン先頭または適切な位置に挿入
        queryClient.setQueryData<{ posts: Post[] }>(['posts'], {
          posts: [optimisticPost, ...previousData.posts],
        });
      }

      return { previousData };
    },
    // エラー時はロールバック
    onError: (_err, _newPost, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['posts'], context.previousData);
      }
    },
    // 成功・失敗に関わらず再検証して正規データと同期
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  // ピン留め動的トグル
  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) {
        throw new Error('ピン留めの更新に失敗しました');
      }
      return res.json();
    },
    onMutate: async ({ id, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const previousData = queryClient.getQueryData<{ posts: Post[] }>(['posts']);

      if (previousData) {
        queryClient.setQueryData<{ posts: Post[] }>(['posts'], {
          posts: previousData.posts.map((post) =>
            post.id === id ? { ...post, pinned } : post
          ),
        });
      }

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['posts'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  return {
    ...postsQuery,
    createPost: createPostMutation.mutate,
    createPostAsync: createPostMutation.mutateAsync,
    isCreating: createPostMutation.isPending,
    togglePin: togglePinMutation.mutate,
    isTogglingPin: togglePinMutation.isPending,
  };
}
