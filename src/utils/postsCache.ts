import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Post } from '../types';

/**
 * タイムライン投稿一覧（['posts']）キャッシュの読み書きを集約するヘルパー
 * - ['posts'] キャッシュへの直接の setQueryData はこのファイル以外で行わない
 * - setQueriesData を使い、クエリキーに条件が加わった場合（['posts', params]）も全エントリへ反映する
 */

export const POSTS_QUERY_KEY = ['posts'] as const;

export type PostsData = { posts: Post[] };

// ロールバック用スナップショット（各クエリキーとその時点のデータの組）
export type PostsSnapshot = Array<[QueryKey, PostsData | undefined]>;

// 指定IDの投稿を updater で置き換える
export function updatePost(qc: QueryClient, id: string, updater: (post: Post) => Post): void {
  qc.setQueriesData<PostsData>({ queryKey: POSTS_QUERY_KEY }, (old) => {
    if (!old) return old;
    return { posts: old.posts.map((p) => (p.id === id ? updater(p) : p)) };
  });
}

// 投稿を一覧の先頭に挿入する（キャッシュ未取得の場合は何もしない）
export function prependPost(qc: QueryClient, post: Post): void {
  qc.setQueriesData<PostsData>({ queryKey: POSTS_QUERY_KEY }, (old) => {
    if (!old) return old;
    return { posts: [post, ...old.posts] };
  });
}

// 指定IDの投稿を一覧から取り除く
export function removePost(qc: QueryClient, id: string): void {
  qc.setQueriesData<PostsData>({ queryKey: POSTS_QUERY_KEY }, (old) => {
    if (!old) return old;
    return { posts: old.posts.filter((p) => p.id !== id) };
  });
}

// 楽観的更新の前に現在のキャッシュを保存する
export function snapshotPosts(qc: QueryClient): PostsSnapshot {
  return qc.getQueriesData<PostsData>({ queryKey: POSTS_QUERY_KEY });
}

// snapshotPosts で保存した状態にキャッシュを戻す
export function restorePosts(qc: QueryClient, snapshot: PostsSnapshot): void {
  for (const [key, data] of snapshot) {
    qc.setQueryData(key, data);
  }
}
