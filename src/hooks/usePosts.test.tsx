// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Post, PostsPage } from '../types';
import type { PostsQueryParams } from './useTimelineFilter';
import { usePostMutations, usePostsQuery } from './usePosts';

const PARAMS: PostsQueryParams = { order: 'desc', pin: '1' };

function post(id: string, extra: Partial<Post> = {}): Post {
  return { id, title: `title-${id}`, createdTime: '2026-10-01T00:00:00.000Z', createdBy: { id: 'u', name: 'u' }, tags: [], pinned: false, ...extra };
}

function page(posts: Post[]): PostsPage {
  return { posts, nextCursor: null, hasMore: false };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const INITIAL = [post('a'), post('b', { pinned: true }), post('c')];

// fetch を差し替える（実際の通信はしない）
// - GET /api/posts: 1 回目は INITIAL を返し、2 回目以降（onSettled の再取得）は refetchPage が決まるまで応答しない
// - 書き込み（POST・PATCH）: write が返す応答を、release されるまで保留する
let fetchMock: ReturnType<typeof vi.fn>;
let refetchPage: PostsPage | null;
let releaseWrite: (res: Response) => void;
let writeResponse: Promise<Response>;

function holdWrite() {
  writeResponse = new Promise((resolve) => {
    releaseWrite = resolve;
  });
}

beforeEach(() => {
  refetchPage = null;
  holdWrite();
  let getCount = 0;
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'GET' && url.startsWith('/api/posts?')) {
      getCount++;
      if (getCount === 1) return Promise.resolve(json(page(INITIAL)));
      // 再取得の応答で一覧が上書きされ、ロールバックの結果が見えなくなるのを防ぐ
      return refetchPage ? Promise.resolve(json(refetchPage)) : new Promise<Response>(() => {});
    }
    if (method === 'POST' || method === 'PATCH') return writeResponse;
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => ({ query: usePostsQuery(PARAMS), mutations: usePostMutations() }), { wrapper });
  await waitFor(() => expect(hook.result.current.query.posts).toEqual(INITIAL));
  return hook;
}

function writeCalls() {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH');
}

function getCalls() {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'GET');
}

// 書き込みを失敗させ、ロールバックと再取得の要求まで待つ
async function failWrite() {
  await act(async () => {
    releaseWrite(json({ message: '保存に失敗しました' }, 500));
  });
  await waitFor(() => expect(getCalls().length).toBeGreaterThanOrEqual(2));
}

describe('usePostMutations の楽観的更新とロールバック', () => {
  it('作成: 送信中は仮の投稿を先頭に表示し、API が失敗したら元の一覧に戻す', async () => {
    const { result } = await setup();
    const onError = vi.fn();

    act(() => {
      result.current.mutations.createPost({ title: '新しい投稿', tagIds: ['t1'], pinned: true }, { onError });
    });
    await waitFor(() => expect(result.current.query.posts).toHaveLength(4));
    expect(result.current.query.posts[0]).toMatchObject({
      title: '新しい投稿',
      tags: [{ id: 't1' }],
      pinned: true,
      isOptimistic: true,
    });
    expect(result.current.query.posts.slice(1)).toEqual(INITIAL);

    await failWrite();
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(result.current.query.posts).toEqual(INITIAL);
  });

  it('作成: 成功したら、再取得した一覧で仮の投稿が置き換わる', async () => {
    const { result } = await setup();
    const created = post('new', { title: '新しい投稿' });

    act(() => {
      result.current.mutations.createPost({ title: '新しい投稿' });
    });
    await waitFor(() => expect(result.current.query.posts[0]?.isOptimistic).toBe(true));
    const tempId = result.current.query.posts[0].id;
    expect(tempId).toMatch(/^temp-/);

    refetchPage = page([created, ...INITIAL]);
    await act(async () => {
      releaseWrite(json({ success: true, id: 'new', dailyReportLinked: false }, 201));
    });

    await waitFor(() => expect(result.current.query.posts).toEqual([created, ...INITIAL]));
    expect(result.current.query.posts.some((p) => p.id === tempId || p.isOptimistic)).toBe(false);
    expect(writeCalls()).toHaveLength(1);
    expect(JSON.parse(writeCalls()[0][1].body)).toEqual({ title: '新しい投稿' });
  });

  it('ピン留め: 送信中は切り替えた状態を表示し、API が失敗したら元に戻す', async () => {
    const { result } = await setup();

    act(() => {
      result.current.mutations.togglePin({ id: 'a', pinned: true });
    });
    await waitFor(() => expect(result.current.query.posts[0].pinned).toBe(true));

    await failWrite();
    await waitFor(() => expect(result.current.query.posts).toEqual(INITIAL));
    expect(writeCalls()[0][0]).toBe('/api/posts/a');
    expect(JSON.parse(writeCalls()[0][1].body)).toEqual({ pinned: true });
  });

  it('アーカイブ: 送信中は一覧から取り除き、API が失敗したら元の位置に戻す', async () => {
    const { result } = await setup();

    act(() => {
      result.current.mutations.archivePost('b');
    });
    await waitFor(() => expect(result.current.query.posts.map((p) => p.id)).toEqual(['a', 'c']));

    await failWrite();
    await waitFor(() => expect(result.current.query.posts).toEqual(INITIAL));
    expect(writeCalls()[0][0]).toBe('/api/posts/b');
    expect(JSON.parse(writeCalls()[0][1].body)).toEqual({ archived: true });
  });

  it('タイトル変更: 送信中は新しいタイトルを表示し、API が失敗したら元に戻す', async () => {
    const { result } = await setup();

    act(() => {
      result.current.mutations.updateTitle({ id: 'c', title: '変更後' });
    });
    await waitFor(() => expect(result.current.query.posts[2].title).toBe('変更後'));

    await failWrite();
    await waitFor(() => expect(result.current.query.posts).toEqual(INITIAL));
    expect(writeCalls()[0][0]).toBe('/api/posts/c');
    expect(JSON.parse(writeCalls()[0][1].body)).toEqual({ title: '変更後' });
  });
});
