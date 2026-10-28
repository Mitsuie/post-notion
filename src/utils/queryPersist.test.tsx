// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { dehydrate, hashKey, QueryClient } from '@tanstack/react-query';
import {
  PersistQueryClientProvider,
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import type { Post, PostsPage, TagsResponse } from '../types';
import { CLEARED_FILTER, DEFAULT_FILTER, toPostsQueryParams } from '../hooks/useTimelineFilter';
import { usePostsQuery } from '../hooks/usePosts';
import type { PostsData } from './postsCache';
import { STORAGE_KEYS } from './storage';
import { createPersistOptions, isDefaultPostsQueryKey, refetchRestoredQueries } from './queryPersist';

const NOW = new Date(2026, 9, 28, 12, 0, 0);
const DEFAULT_PARAMS = toPostsQueryParams(DEFAULT_FILTER, 'desc', true, NOW);

function post(id: string, extra: Partial<Post> = {}): Post {
  return { id, title: `title-${id}`, createdTime: '2026-10-01T00:00:00.000Z', createdBy: { id: 'u', name: 'u' }, tags: [], pinned: false, ...extra };
}

function page(posts: Post[], nextCursor: string | null = null): PostsPage {
  return { posts, nextCursor, hasMore: nextCursor !== null };
}

function postsData(...pages: PostsPage[]): PostsData {
  return { pages, pageParams: pages.map((_, i) => (i === 0 ? null : `cursor-${i}`)) };
}

const TAGS: TagsResponse = { tags: [{ id: 't1', name: 'tag1' }] };

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function persistedKeys(client: QueryClient) {
  return dehydrate(client, createPersistOptions().dehydrateOptions).queries.map((q) => hashKey(q.queryKey));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('保存対象の選別', () => {
  it('タグ一覧と既定の条件のタイムラインだけを保存し、本文・コメント・接続状況・設定・絞り込み結果は保存しない', () => {
    const client = newClient();
    const data = postsData(page([post('a')]));
    client.setQueryData(['tags'], TAGS);
    client.setQueryData(['posts', DEFAULT_PARAMS], data);
    // 並び順・ピン留め優先を変えても既定の条件として扱う
    const ascParams = toPostsQueryParams(DEFAULT_FILTER, 'asc', false, NOW);
    client.setQueryData(['posts', ascParams], data);
    // 絞り込み中（タグ・キーワード・期間の変更・全期間）は保存しない
    client.setQueryData(['posts', toPostsQueryParams({ ...DEFAULT_FILTER, selectedTagIds: ['t1'] }, 'desc', true, NOW)], data);
    client.setQueryData(['posts', toPostsQueryParams({ ...DEFAULT_FILTER, keyword: 'abc' }, 'desc', true, NOW)], data);
    client.setQueryData(['posts', toPostsQueryParams({ ...DEFAULT_FILTER, datePreset: '7d' }, 'desc', true, NOW)], data);
    client.setQueryData(['posts', toPostsQueryParams(CLEARED_FILTER, 'desc', true, NOW)], data);
    client.setQueryData(['post-blocks', 'a'], { markdown: 'body' });
    client.setQueryData(['post-comments', 'a'], { comments: [] });
    client.setQueryData(['system-status'], { ok: true });
    client.setQueryData(['app-config'], { ok: true });

    expect(persistedKeys(client).sort()).toEqual(
      [hashKey(['tags']), hashKey(['posts', DEFAULT_PARAMS]), hashKey(['posts', ascParams])].sort()
    );
  });

  it('取得に失敗したクエリは保存しない', async () => {
    const client = newClient();
    await client.prefetchQuery({ queryKey: ['tags'], queryFn: () => Promise.reject(new Error('fail')) });
    expect(client.getQueryState(['tags'])?.status).toBe('error');
    expect(persistedKeys(client)).toEqual([]);
  });

  it('前日の既定の条件は、期間の境界が変わるため既定の条件として扱わない', () => {
    const yesterday = new Date(2026, 9, 27, 12, 0, 0);
    const yesterdayParams = toPostsQueryParams(DEFAULT_FILTER, 'desc', true, yesterday);
    expect(isDefaultPostsQueryKey(['posts', yesterdayParams], yesterday)).toBe(true);
    expect(isDefaultPostsQueryKey(['posts', yesterdayParams], NOW)).toBe(false);
  });
});

describe('保存時の切り詰め', () => {
  it('2 ページ以上読み込んでいても先頭 1 ページだけを保存し、仮の投稿を含めない', () => {
    const client = newClient();
    client.setQueryData(
      ['posts', DEFAULT_PARAMS],
      postsData(
        page([post('temp-1', { isOptimistic: true }), post('a'), post('b')], 'cursor-1'),
        page([post('c')], 'cursor-2'),
        page([post('d')])
      )
    );

    const [persisted] = dehydrate(client, createPersistOptions().dehydrateOptions).queries;
    expect(persisted.state.data).toEqual({
      pages: [page([post('a'), post('b')], 'cursor-1')],
      pageParams: [null],
    });
    // メモリ上のキャッシュは変えない
    expect(client.getQueryData<PostsData>(['posts', DEFAULT_PARAMS])?.pages).toHaveLength(3);
  });

  it('タグ一覧はそのまま保存する', () => {
    const client = newClient();
    client.setQueryData(['tags'], TAGS);
    const [persisted] = dehydrate(client, createPersistOptions().dehydrateOptions).queries;
    expect(persisted.state.data).toEqual(TAGS);
  });
});

describe('localStorage への保存と復元', () => {
  it('保存した内容を新しい QueryClient に復元できる', async () => {
    const options = createPersistOptions();
    const source = newClient();
    source.setQueryData(['tags'], TAGS);
    source.setQueryData(['posts', DEFAULT_PARAMS], postsData(page([post('a')], 'cursor-1'), page([post('b')])));
    source.setQueryData(['post-blocks', 'a'], { markdown: 'body' });

    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);
    await persistQueryClientSave({ ...options, queryClient: source });
    vi.advanceTimersByTime(1000); // 保存は throttle される
    vi.useFakeTimers({ toFake: ['Date'] });

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.queryCache) ?? 'null');
    expect(raw.buster).toBe(__APP_VERSION__);

    const target = newClient();
    await persistQueryClientRestore({ ...options, queryClient: target });
    expect(target.getQueryData(['tags'])).toEqual(TAGS);
    expect(target.getQueryData(['posts', DEFAULT_PARAMS])).toEqual(postsData(page([post('a')], 'cursor-1')));
    expect(target.getQueryData(['post-blocks', 'a'])).toBeUndefined();
  });

  it('アプリのバージョンが異なる保存内容と、24 時間を過ぎた保存内容は破棄する', async () => {
    const options = createPersistOptions();
    const clientState = { mutations: [], queries: [] };

    localStorage.setItem(STORAGE_KEYS.queryCache, JSON.stringify({ buster: 'old', timestamp: Date.now(), clientState }));
    await persistQueryClientRestore({ ...options, queryClient: newClient() });
    expect(localStorage.getItem(STORAGE_KEYS.queryCache)).toBeNull();

    const expired = Date.now() - 1000 * 60 * 60 * 24 - 1;
    localStorage.setItem(STORAGE_KEYS.queryCache, JSON.stringify({ buster: __APP_VERSION__, timestamp: expired, clientState }));
    await persistQueryClientRestore({ ...options, queryClient: newClient() });
    expect(localStorage.getItem(STORAGE_KEYS.queryCache)).toBeNull();
  });

  it('復元後に古い扱いにして再取得させる', () => {
    const client = newClient();
    client.setQueryData(['tags'], TAGS);
    client.setQueryData(['posts', DEFAULT_PARAMS], postsData(page([post('a')])));
    refetchRestoredQueries(client);
    expect(client.getQueryState(['tags'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['posts', DEFAULT_PARAMS])?.isInvalidated).toBe(true);
  });
});

describe('起動直後の表示', () => {
  it('保存した内容を通信を待たずに表示し、裏で再取得した最新の内容に置き換える', async () => {
    // 前回の起動で保存した内容
    const source = newClient();
    source.setQueryData(['posts', DEFAULT_PARAMS], postsData(page([post('cached')])));
    localStorage.setItem(
      STORAGE_KEYS.queryCache,
      JSON.stringify({
        buster: __APP_VERSION__,
        timestamp: Date.now(),
        clientState: dehydrate(source, createPersistOptions().dehydrateOptions),
      })
    );

    let resolveFetch: (res: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = newClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PersistQueryClientProvider
        client={client}
        persistOptions={createPersistOptions()}
        onSuccess={() => refetchRestoredQueries(client)}
      >
        {children}
      </PersistQueryClientProvider>
    );
    const hook = renderHook(() => usePostsQuery(DEFAULT_PARAMS), { wrapper });

    // 復元前は読み込み中として扱う（「投稿がありません」を出さない）
    expect(hook.result.current.isLoading).toBe(true);
    expect(hook.result.current.posts).toEqual([]);

    // 通信の完了前に、保存した内容が表示される
    await waitFor(() => expect(hook.result.current.posts.map((p) => p.id)).toEqual(['cached']));
    expect(hook.result.current.isLoading).toBe(false);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    resolveFetch(
      new Response(JSON.stringify(page([post('latest'), post('cached')])), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    await waitFor(() => expect(hook.result.current.posts.map((p) => p.id)).toEqual(['latest', 'cached']));
  });
});
