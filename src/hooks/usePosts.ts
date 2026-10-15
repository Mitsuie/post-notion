import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Post, PostsPage, CreatePostInput } from '../types';
import { apiFetch } from '../utils/apiClient';
import {
  POSTS_QUERY_KEY,
  prependPost,
  updatePost,
  snapshotPosts,
  restorePosts,
} from '../utils/postsCache';

export function usePosts() {
  const queryClient = useQueryClient();

  // タイムライン一覧取得（50件ずつのカーソルページング）
  const postsQuery = useInfiniteQuery({
    queryKey: POSTS_QUERY_KEY,
    queryFn: async ({ pageParam }) => {
      const query = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<PostsPage>(`/api/posts${query}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 1000 * 60 * 5, // 5分間キャッシュ
  });

  // 読み込み済みの全ページを1つの一覧に平坦化
  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [postsQuery.data]
  );

  // 楽観的UI更新付きの新規投稿
  const createPostMutation = useMutation({
    mutationFn: async (input: CreatePostInput) => {
      return apiFetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
    // 楽観的更新: 送信直後に仮データをタイムライン先頭へ挿入
    onMutate: async (newPostInput) => {
      // 進行中のフェッチをキャンセル
      await queryClient.cancelQueries({ queryKey: POSTS_QUERY_KEY });

      // 前の状態をスナップショット保存
      const snapshot = snapshotPosts(queryClient);

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

      // タイムライン先頭へ挿入（一覧が未取得の場合は何もしない）
      prependPost(queryClient, optimisticPost);

      return { snapshot };
    },
    // エラー時はロールバック
    onError: (_err, _newPost, context) => {
      if (context?.snapshot) {
        restorePosts(queryClient, context.snapshot);
      }
    },
    // 成功・失敗に関わらず再検証して正規データと同期
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: POSTS_QUERY_KEY });
    },
  });

  // ピン留め動的トグル
  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      return apiFetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
    },
    onMutate: async ({ id, pinned }) => {
      await queryClient.cancelQueries({ queryKey: POSTS_QUERY_KEY });
      const snapshot = snapshotPosts(queryClient);

      updatePost(queryClient, id, (post) => ({ ...post, pinned }));

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        restorePosts(queryClient, context.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: POSTS_QUERY_KEY });
    },
  });

  return {
    posts,
    isLoading: postsQuery.isLoading,
    fetchNextPage: postsQuery.fetchNextPage,
    hasNextPage: postsQuery.hasNextPage,
    isFetchingNextPage: postsQuery.isFetchingNextPage,
    createPost: createPostMutation.mutate,
    createPostAsync: createPostMutation.mutateAsync,
    isCreating: createPostMutation.isPending,
    togglePin: togglePinMutation.mutate,
    isTogglingPin: togglePinMutation.isPending,
  };
}
