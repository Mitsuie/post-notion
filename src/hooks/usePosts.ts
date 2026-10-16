import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { Post, PostsPage, CreatePostInput, CreatePostResult } from '../types';
import { apiFetch } from '../utils/apiClient';
import {
  POSTS_QUERY_KEY,
  prependPost,
  updatePost,
  removePost,
  snapshotPosts,
  restorePosts,
} from '../utils/postsCache';
import type { PostsQueryParams } from './useTimelineFilter';

/**
 * タイムライン一覧取得（作成日・タグ・並び順の条件をサーバー側で適用し、50件ずつカーソルページング）
 */
export function usePostsQuery(params: PostsQueryParams) {
  const postsQuery = useInfiniteQuery({
    queryKey: [...POSTS_QUERY_KEY, params],
    queryFn: async ({ pageParam }) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) search.set(key, value);
      }
      if (pageParam) search.set('cursor', pageParam);
      return apiFetch<PostsPage>(`/api/posts?${search.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    // 条件切り替え中は直前の結果を表示し、ちらつきを防ぐ
    placeholderData: keepPreviousData,
    // 別端末での投稿を反映するため、1分以上経過していればタブ・アプリへの復帰時に再取得する
    // （読み込み済みの全ページを順に再取得する。maxPages は先頭ページが破棄されるため使わない）
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60,
  });

  // 読み込み済みの全ページを1つの一覧に平坦化
  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [postsQuery.data]
  );

  return {
    posts,
    isLoading: postsQuery.isLoading,
    isPlaceholderData: postsQuery.isPlaceholderData,
    fetchNextPage: postsQuery.fetchNextPage,
    hasNextPage: postsQuery.hasNextPage,
    isFetchingNextPage: postsQuery.isFetchingNextPage,
  };
}

/**
 * 投稿の作成・ピン留め（楽観的更新付き）
 */
export function usePostMutations() {
  const queryClient = useQueryClient();

  // 楽観的UI更新付きの新規投稿
  const createPostMutation = useMutation({
    mutationFn: async (input: CreatePostInput) => {
      return apiFetch<CreatePostResult>('/api/posts', {
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

      // 現在表示中の一覧の先頭へ挿入（一覧が未取得の場合は何もしない）
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

  // 投稿のアーカイブ（楽観的にタイムラインから取り除き、失敗時は元に戻す）
  const archivePostMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: POSTS_QUERY_KEY });
      const snapshot = snapshotPosts(queryClient);
      removePost(queryClient, id);
      return { snapshot };
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) {
        restorePosts(queryClient, context.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: POSTS_QUERY_KEY });
    },
  });

  return {
    archivePost: archivePostMutation.mutate,
    createPost: createPostMutation.mutate,
    createPostAsync: createPostMutation.mutateAsync,
    isCreating: createPostMutation.isPending,
    togglePin: togglePinMutation.mutate,
    isTogglingPin: togglePinMutation.isPending,
  };
}
