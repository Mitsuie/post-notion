import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '@notionhq/client';
import { app } from '../app.ts';
import { invalidateSchemaCache } from '../utils/schema.ts';
import { NOTION_UNAVAILABLE_MESSAGE, TAG_LIMIT_HINT } from '../utils/errors.ts';

const ORIGIN = 'http://localhost';
const POSTS_DB = '0123456789abcdef0123456789abcdef';
const OTHER_DB = 'ffffffffffffffffffffffffffffffff';
const PAGE_ID = '11111111-2222-3333-4444-555555555555';
const POSTS_DS = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ENV = { NOTION_API_KEY: 'k', NOTION_POSTS_DATABASE_ID: POSTS_DB, NOTION_TAGS_DATABASE_ID: '', NOTION_DAILY_REPORT_DATABASE_ID: '' };

function call(method: string, path: string, body?: string) {
  return app.request(
    `${ORIGIN}${path}`,
    { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body },
    ENV
  );
}

// Notion SDK の通信を差し替える（実際の Notion には接続しない）
let notion: ReturnType<typeof vi.fn>;
beforeEach(() => {
  notion = vi.fn();
  vi.spyOn(Client.prototype as any, 'request').mockImplementation(notion as any);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('投稿IDの検証', () => {
  it('不正な ID の本文・コメント取得は 400（Notion を呼ばない）', async () => {
    for (const path of ['/api/posts/bad-id/blocks', '/api/posts/bad-id/comments']) {
      const res = await app.request(`${ORIGIN}${path}`, {}, ENV);
      expect(res.status).toBe(400);
    }
    expect(notion).not.toHaveBeenCalled();
  });

  it('不正な ID の PATCH・コメント投稿は 400', async () => {
    expect((await call('PATCH', '/api/posts/..%2F..', '{"pinned":true}')).status).toBe(400);
    expect((await call('POST', '/api/posts/xyz/comments', '{"text":"a"}')).status).toBe(400);
    expect(notion).not.toHaveBeenCalled();
  });
});

describe('リクエスト本文の検証', () => {
  it('JSON として解析できない本文は 400', async () => {
    expect((await call('POST', '/api/posts', '{bad json')).status).toBe(400);
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, 'not json')).status).toBe(400);
    expect((await call('POST', `/api/posts/${PAGE_ID}/comments`, '[')).status).toBe(400);
    expect(notion).not.toHaveBeenCalled();
  });

  it('型が不正な値は 400', async () => {
    expect((await call('POST', '/api/posts', JSON.stringify({ title: 1 }))).status).toBe(400);
    expect((await call('POST', '/api/posts', JSON.stringify({ title: 'a', tagIds: ['../x'] }))).status).toBe(400);
    expect((await call('POST', '/api/posts', JSON.stringify({ title: 'a', pinned: 'yes' }))).status).toBe(400);
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ pinned: 'true' }))).status).toBe(400);
    expect((await call('POST', `/api/posts/${PAGE_ID}/comments`, JSON.stringify({ text: 'a', discussionId: 'x' }))).status).toBe(400);
    expect(notion).not.toHaveBeenCalled();
  });
});

describe('Posts DB への所属確認', () => {
  it('他の DB のページは PATCH・コメント投稿とも 404 で、更新しない', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`) return { id: PAGE_ID, parent: { database_id: OTHER_DB } };
      throw new Error(`unexpected ${method} ${path}`);
    });
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ pinned: true }))).status).toBe(404);
    expect((await call('POST', `/api/posts/${PAGE_ID}/comments`, JSON.stringify({ text: 'hi' }))).status).toBe(404);
    expect(notion.mock.calls.every(([args]: any) => args.method === 'get')).toBe(true);
  });

  it('Posts DB のページへのコメントは、取得済みのページを使い回して pages.retrieve を1回にする', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`)
        return { id: PAGE_ID, parent: { database_id: '01234567-89ab-cdef-0123-456789abcdef' }, properties: { コメント数: { type: 'number', number: 2 } } };
      if (method === 'post' && path === 'comments') return { id: 'c1', discussion_id: 'd1', rich_text: [{ plain_text: 'hi' }] };
      if (method === 'patch' && path === `pages/${PAGE_ID}`) return { id: PAGE_ID };
      throw new Error(`unexpected ${method} ${path}`);
    });
    const res = await call('POST', `/api/posts/${PAGE_ID}/comments`, JSON.stringify({ text: 'hi' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ commentsCount: 3 });
    expect(notion.mock.calls.filter(([args]: any) => args.method === 'get')).toHaveLength(1);
  });
});

describe('本文・コメント一覧の取得（Posts DB への所属確認・全件取得）', () => {
  const ownPage = { id: PAGE_ID, parent: { database_id: POSTS_DB }, url: 'https://www.notion.so/own', properties: { コメント数: { type: 'number', number: 0 } } };
  const comment = (i: number) => ({ id: `c${i}`, discussion_id: 'd1', rich_text: [{ plain_text: `t${i}` }], created_time: '2026-10-28T00:00:00.000Z' });
  const calls = (method: string, path: string) => notion.mock.calls.filter(([args]: any) => args.method === method && args.path === path);

  // total 件のコメントを 100 件ずつ返す（Infinity なら has_more を返し続ける）
  function mockComments(total: number, storedCount = 0) {
    notion.mockImplementation(async ({ path, method, query }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`)
        return { ...ownPage, properties: { コメント数: { type: 'number', number: storedCount } } };
      if (method === 'get' && path === 'comments') {
        const start = Number(query.start_cursor ?? 0);
        const end = Math.min(start + 100, total);
        const results = Array.from({ length: end - start }, (_, i) => comment(start + i));
        return { results, has_more: end < total, next_cursor: end < total ? String(end) : null };
      }
      if (method === 'patch' && path === `pages/${PAGE_ID}`) return { id: PAGE_ID };
      throw new Error(`unexpected ${method} ${path}`);
    });
  }

  it('他の DB のページは本文・コメント一覧とも 404 で、更新しない', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`) return { ...ownPage, parent: { database_id: OTHER_DB } };
      throw new Error(`unexpected ${method} ${path}`);
    });
    expect((await app.request(`${ORIGIN}/api/posts/${PAGE_ID}/blocks`, {}, ENV)).status).toBe(404);
    expect((await app.request(`${ORIGIN}/api/posts/${PAGE_ID}/comments`, {}, ENV)).status).toBe(404);
    expect(notion.mock.calls.every(([args]: any) => args.method === 'get' && args.path === `pages/${PAGE_ID}`)).toBe(true);
  });

  it('本文の取得は pages.retrieve を1回だけ呼び、ページの url を返す', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`) return ownPage;
      if (method === 'get' && path === `blocks/${PAGE_ID}/children`) return { results: [], has_more: false, next_cursor: null };
      throw new Error(`unexpected ${method} ${path}`);
    });
    const res = await app.request(`${ORIGIN}/api/posts/${PAGE_ID}/blocks`, {}, ENV);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: ownPage.url });
    expect(calls('get', `pages/${PAGE_ID}`)).toHaveLength(1);
  });

  it('コメント 100 件以下では pages.retrieve と comments.list を1回ずつ呼び、件数が一致すれば更新しない', async () => {
    mockComments(2, 2);
    const res = await app.request(`${ORIGIN}/api/posts/${PAGE_ID}/comments`, {}, ENV);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ commentsCount: 2 });
    expect(calls('get', `pages/${PAGE_ID}`)).toHaveLength(1);
    expect(calls('get', 'comments')).toHaveLength(1);
    expect(notion).toHaveBeenCalledTimes(2);
  });

  it('コメントが 150 件（2 ページ）あれば 150 件を返し、件数を 150 で同期する', async () => {
    mockComments(150, 100);
    const res = await app.request(`${ORIGIN}/api/posts/${PAGE_ID}/comments`, {}, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { comments: unknown[]; commentsCount: number };
    expect(body.comments).toHaveLength(150);
    expect(body.commentsCount).toBe(150);
    expect(calls('get', 'comments').map(([args]: any) => args.query.start_cursor)).toEqual([undefined, '100']);
    expect(calls('get', `pages/${PAGE_ID}`)).toHaveLength(1);
    const update = calls('patch', `pages/${PAGE_ID}`);
    expect(update).toHaveLength(1);
    expect(update[0][0].body).toEqual({ properties: { コメント数: { number: 150 } } });
  });

  it('上限（10 ページ）で打ち切った場合は件数を同期せず、commentsCount を返さない', async () => {
    mockComments(Infinity);
    const res = await app.request(`${ORIGIN}/api/posts/${PAGE_ID}/comments`, {}, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { comments: unknown[]; commentsCount?: number };
    expect(body.comments).toHaveLength(1000);
    expect(body.commentsCount).toBeUndefined();
    expect(calls('get', 'comments')).toHaveLength(10);
    expect(calls('patch', `pages/${PAGE_ID}`)).toHaveLength(0);
  });
});

describe('エラーメッセージの定型化', () => {
  it('Notion の生のエラーメッセージをクライアントに返さない', async () => {
    notion.mockRejectedValue(Object.assign(new Error('SECRET internal detail'), { code: 'invalid_request' }));
    const res = await app.request(`${ORIGIN}/api/posts`, {}, ENV);
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain('SECRET');
    expect(JSON.parse(body).message).toBe('投稿一覧の取得に失敗しました');
  });

  it('Notion の一時障害は 503 で再試行を促し、生のメッセージを返さない', async () => {
    notion.mockRejectedValue(Object.assign(new Error('SECRET internal detail'), { code: 'internal_server_error' }));
    const res = await app.request(`${ORIGIN}/api/posts`, {}, ENV);
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(body).not.toContain('SECRET');
    expect(JSON.parse(body).message).toBe(NOTION_UNAVAILABLE_MESSAGE);
  });

  it('タグ1件制限の超過は 400 と案内メッセージ', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `databases/${POSTS_DB}`) return { data_sources: [{ id: POSTS_DS }] };
      if (method === 'get' && path === `data_sources/${POSTS_DS}`) return { properties: { Name: { type: 'title' }, タグ: { type: 'relation' } } };
      if (path === 'pages') throw Object.assign(new Error('Relation property has a limit of 1, but 2 values were provided.'), { code: 'validation_error' });
      throw new Error('unexpected');
    });
    const tags = ['0123456789abcdef0123456789abcd01', '0123456789abcdef0123456789abcd02'];
    const res = await call('POST', '/api/posts', JSON.stringify({ title: 'a', tagIds: tags, linkDailyReport: false }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toContain('1件に制限');
  });

  it('limit を含まない validation_error でもタグを2件以上送っていればタグ1件の補足を付ける', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `databases/${POSTS_DB}`) return { data_sources: [{ id: POSTS_DS }] };
      if (method === 'get' && path === `data_sources/${POSTS_DS}`) return { properties: { Name: { type: 'title' }, タグ: { type: 'relation' } } };
      if (path === 'pages') throw Object.assign(new Error('Relation property accepts only one value.'), { code: 'validation_error' });
      throw new Error('unexpected');
    });
    const tags = ['0123456789abcdef0123456789abcd01', '0123456789abcdef0123456789abcd02'];
    const res = await call('POST', '/api/posts', JSON.stringify({ title: 'a', tagIds: tags, linkDailyReport: false }));
    expect(res.status).toBe(500);
    expect(((await res.json()) as { message: string }).message).toBe(`投稿の作成に失敗しました。${TAG_LIMIT_HINT}`);
  });
});

describe('投稿のアーカイブ', () => {
  const ownPage = { id: PAGE_ID, parent: { database_id: POSTS_DB }, properties: {} };

  it('archived: true で Posts DB のページをアーカイブする', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`) return ownPage;
      if (method === 'patch' && path === `pages/${PAGE_ID}`) return { id: PAGE_ID };
      throw new Error(`unexpected ${method} ${path}`);
    });
    const res = await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ archived: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, archived: true });
    const update = notion.mock.calls.find(([args]: any) => args.method === 'patch')![0];
    expect(update.body).toMatchObject({ archived: true });
  });

  it('他の DB のページはアーカイブしない（404）', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`) return { ...ownPage, parent: { database_id: OTHER_DB } };
      throw new Error(`unexpected ${method} ${path}`);
    });
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ archived: true }))).status).toBe(404);
    expect(notion.mock.calls.some(([args]: any) => args.method === 'patch')).toBe(false);
  });

  it('archived が真偽値でない・更新内容がない場合は 400', async () => {
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ archived: 'yes' }))).status).toBe(400);
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ archived: false }))).status).toBe(400);
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({}))).status).toBe(400);
    expect(notion).not.toHaveBeenCalled();
  });
});

describe('タイトルの変更', () => {
  const ownPage = { id: PAGE_ID, parent: { database_id: POSTS_DB }, properties: {} };
  function mockUpdate() {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`) return ownPage;
      if (method === 'get' && path === `databases/${POSTS_DB}`) return { data_sources: [{ id: POSTS_DS }] };
      if (method === 'get' && path === `data_sources/${POSTS_DS}`) return { properties: { Name: { type: 'title' } } };
      if (method === 'patch' && path === `pages/${PAGE_ID}`) return { id: PAGE_ID };
      throw new Error(`unexpected ${method} ${path}`);
    });
  }

  it('改行をスペースに置換し、2,000 文字ごとに分割して保存する', async () => {
    mockUpdate();
    const title = `一行目\n${'あ'.repeat(2500)}`;
    const res = await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ title }));
    expect(res.status).toBe(200);
    const update = notion.mock.calls.find(([args]: any) => args.method === 'patch')![0];
    const items = update.body.properties.Name.title.map((t: any) => t.text.content);
    expect(items.join('')).toBe(`一行目 ${'あ'.repeat(2500)}`);
    expect(items.map((t: string) => t.length)).toEqual([2000, 504]);
  });

  it('空のタイトル（空白・改行のみを含む）は 400', async () => {
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ title: ' \n ' }))).status).toBe(400);
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ title: 1 }))).status).toBe(400);
    expect(notion).not.toHaveBeenCalled();
  });
});

describe('データソース API（Notion API 2025-09-03）', () => {
  beforeEach(() => invalidateSchemaCache());

  it('投稿一覧は Posts DB のデータソースに問い合わせる', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `databases/${POSTS_DB}`) return { data_sources: [{ id: POSTS_DS }] };
      if (method === 'post' && path === `data_sources/${POSTS_DS}/query`) return { results: [], next_cursor: null, has_more: false };
      throw new Error(`unexpected ${method} ${path}`);
    });
    const res = await app.request(`${ORIGIN}/api/posts`, {}, ENV);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ posts: [], hasMore: false });
  });

  it('投稿の作成は parent にデータソース ID を指定する', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `databases/${POSTS_DB}`) return { data_sources: [{ id: POSTS_DS }] };
      if (method === 'get' && path === `data_sources/${POSTS_DS}`) return { properties: { Name: { type: 'title' } } };
      if (method === 'post' && path === 'pages') return { id: PAGE_ID, created_time: '2026-10-17T00:00:00.000Z', url: 'x', properties: {} };
      throw new Error(`unexpected ${method} ${path}`);
    });
    const res = await call('POST', '/api/posts', JSON.stringify({ title: 'a', linkDailyReport: false }));
    expect(res.status).toBe(200);
    const create = notion.mock.calls.find(([args]: any) => args.path === 'pages')![0];
    expect(create.body.parent).toEqual({ data_source_id: POSTS_DS });
  });

  it('v5 の応答（parent.type が data_source_id）でも Posts DB の所属を確認できる', async () => {
    const v5Parent = { type: 'data_source_id', data_source_id: POSTS_DS, database_id: '01234567-89ab-cdef-0123-456789abcdef' };
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get' && path === `pages/${PAGE_ID}`) return { id: PAGE_ID, parent: v5Parent, properties: {} };
      if (method === 'patch' && path === `pages/${PAGE_ID}`) return { id: PAGE_ID };
      throw new Error(`unexpected ${method} ${path}`);
    });
    expect((await call('PATCH', `/api/posts/${PAGE_ID}`, JSON.stringify({ archived: true }))).status).toBe(200);
  });
});
