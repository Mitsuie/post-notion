import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { Post, PostsPage } from '../types';

/**
 * タイムライン投稿一覧（['posts']）キャッシュの読み書きを集約するヘルパー
 * - ['posts'] キャッシュへの直接の setQueryData はこのファイル以外で行わない
 * - setQueriesData を使い、クエリキーに条件が加わった場合（['posts', params]）も全エントリへ反映する
 * - キャッシュは useInfiniteQuery のページ配列（InfiniteData<PostsPage>）
 */

export const POSTS_QUERY_KEY = ['posts'] as const;

export type PostsData = InfiniteData<PostsPage, string | null>;

// ロールバック用スナップショット（各クエリキーとその時点のデータの組）
export type PostsSnapshot = Array<[QueryKey, PostsData | undefined]>;

// 全ページの投稿一覧に変換を適用する
function mapPages(data: PostsData, transform: (posts: Post[], pageIndex: number) => Post[]): PostsData {
  return {
    ...data,
    pages: data.pages.map((page, i) => ({ ...page, posts: transform(page.posts, i) })),
  };
}

// 指定IDの投稿を updater で置き換える
export function updatePost(qc: QueryClient, id: string, updater: (post: Post) => Post): void {
  qc.setQueriesData<PostsData>({ queryKey: POSTS_QUERY_KEY }, (old) => {
    if (!old) return old;
    return mapPages(old, (posts) => posts.map((p) => (p.id === id ? updater(p) : p)));
  });
}

// 投稿を現在表示中の一覧の先頭（1ページ目の先頭）に挿入する（キャッシュ未取得の場合は何もしない）
// - 条件の異なる非表示のキャッシュには挿入せず、投稿後の再取得で正規化する
export function prependPost(qc: QueryClient, post: Post): void {
  qc.setQueriesData<PostsData>({ queryKey: POSTS_QUERY_KEY, type: 'active' }, (old) => {
    if (!old || old.pages.length === 0) return old;
    return mapPages(old, (posts, i) => (i === 0 ? [post, ...posts] : posts));
  });
}

// 指定IDの投稿を一覧から取り除く
export function removePost(qc: QueryClient, id: string): void {
  qc.setQueriesData<PostsData>({ queryKey: POSTS_QUERY_KEY }, (old) => {
    if (!old) return old;
    return mapPages(old, (posts) => posts.filter((p) => p.id !== id));
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
