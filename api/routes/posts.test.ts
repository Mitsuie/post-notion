import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '@notionhq/client';
import { app } from '../app.ts';

const ORIGIN = 'http://localhost';
const POSTS_DB = '0123456789abcdef0123456789abcdef';
const OTHER_DB = 'ffffffffffffffffffffffffffffffff';
const PAGE_ID = '11111111-2222-3333-4444-555555555555';
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

describe('エラーメッセージの定型化', () => {
  it('Notion の生のエラーメッセージをクライアントに返さない', async () => {
    notion.mockRejectedValue(Object.assign(new Error('SECRET internal detail'), { code: 'internal_server_error' }));
    const res = await app.request(`${ORIGIN}/api/posts`, {}, ENV);
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain('SECRET');
    expect(JSON.parse(body).message).toBe('投稿一覧の取得に失敗しました');
  });

  it('タグ1件制限の超過は 400 と案内メッセージ', async () => {
    notion.mockImplementation(async ({ path, method }: any) => {
      if (method === 'get') return { properties: { Name: { type: 'title' }, タグ: { type: 'relation' } } };
      if (path === 'pages') throw Object.assign(new Error('Relation property has a limit of 1, but 2 values were provided.'), { code: 'validation_error' });
      throw new Error('unexpected');
    });
    const tags = ['0123456789abcdef0123456789abcd01', '0123456789abcdef0123456789abcd02'];
    const res = await call('POST', '/api/posts', JSON.stringify({ title: 'a', tagIds: tags, linkDailyReport: false }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('1件に制限');
  });
});
