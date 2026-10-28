import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { defaultShouldDehydrateQuery, hashKey, type Query, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import type { PostsPage } from '../types';
import { DEFAULT_FILTER, toPostsQueryParams, type PostsQueryParams } from '../hooks/useTimelineFilter';
import { POSTS_QUERY_KEY, type PostsData } from './postsCache';
import { getItem, removeItem, setItem, STORAGE_KEYS } from './storage';

/**
 * TanStack Query のキャッシュを localStorage に保存し、起動直後から前回の内容を表示する
 * - 保存するのはタグ一覧（['tags']）と、既定の条件（DEFAULT_FILTER）のタイムラインの先頭ページだけ
 *   （本文・コメント・接続状況・設定は保存しない。並び順・ピン留め優先は絞り込みではないため問わない）
 * - 投稿のタイトルが端末に残るため、24 時間で破棄し、アプリの更新時（buster）にも破棄する
 */

export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24;

const TAGS_QUERY_KEY = ['tags'] as const;

// 既定の条件のタイムライン（['posts', params]）か
// - 期間の境界はローカル日付の 0:00 に丸められるため、保存時点の日付で既定の条件を求めて比較する
export function isDefaultPostsQueryKey(queryKey: QueryKey, now: Date = new Date()): boolean {
  if (queryKey.length !== 2 || queryKey[0] !== POSTS_QUERY_KEY[0]) return false;
  const params = queryKey[1] as PostsQueryParams | undefined;
  if (!params || typeof params !== 'object') return false;
  const expected = toPostsQueryParams(DEFAULT_FILTER, params.order, params.pin === '1', now);
  return hashKey([params]) === hashKey([expected]);
}

// 保存対象のクエリか（取得に成功したタグ一覧と、既定の条件のタイムラインのみ）
export function shouldPersistQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  return hashKey(query.queryKey) === hashKey(TAGS_QUERY_KEY) || isDefaultPostsQueryKey(query.queryKey);
}

function isPostsData(data: unknown): data is PostsData {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as PostsData).pages) &&
    Array.isArray((data as PostsData).pageParams)
  );
}

// 保存するデータに変換する
// - タイムライン（ページ配列）は先頭 1 ページに切り詰め、楽観的更新中の仮の投稿を取り除く
//   （起動後の再取得も先頭 1 ページだけになり、続きは先頭ページの nextCursor から読み込める）
export function serializePersistedData(data: unknown): unknown {
  if (!isPostsData(data) || data.pages.length === 0) return data;
  const [firstPage] = data.pages;
  const page: PostsPage = { ...firstPage, posts: firstPage.posts.filter((post) => !post.isOptimistic) };
  return { pages: [page], pageParams: data.pageParams.slice(0, 1) };
}

// キャッシュクリア後に、保留中の保存（throttle）で書き戻されないようにする
let persistDisabled = false;

// 保存先は STORAGE_KEYS.queryCache 固定（storage.ts 経由で、ストレージ無効時の例外を握りつぶす）
const persistStorage = {
  getItem: () => getItem(STORAGE_KEYS.queryCache),
  setItem: (_key: string, value: string) => {
    if (!persistDisabled) setItem(STORAGE_KEYS.queryCache, value);
  },
  removeItem: () => removeItem(STORAGE_KEYS.queryCache),
};

export function createPersistOptions(): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: createSyncStoragePersister({ storage: persistStorage, key: STORAGE_KEYS.queryCache }),
    maxAge: PERSIST_MAX_AGE,
    buster: __APP_VERSION__,
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistQuery,
      // 送信待ちの書き込みは保存しない（オフライン時の投稿キューは扱わない）
      shouldDehydrateMutation: () => false,
      serializeData: serializePersistedData,
    },
  };
}

// 復元した内容を表示しつつ、裏で再取得する
// - 復元直後はクエリの購読前のため、ここでは古い扱いにするだけで、画面のクエリの購読時に取得が始まる
// - タグ一覧の staleTime（24 時間）は起動中の再取得を抑えるためのもので、起動のたびの取得は従来どおり行う
export function refetchRestoredQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: POSTS_QUERY_KEY });
}

// 保存したキャッシュを消し、以降の保存を止める（直後に画面を再読み込みする前提）
export function clearPersistedQueryCache(): void {
  persistDisabled = true;
  removeItem(STORAGE_KEYS.queryCache);
}
