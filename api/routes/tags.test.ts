import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '@notionhq/client';
import { app } from '../app.ts';
import { invalidateSchemaCache } from '../utils/schema.ts';

const ORIGIN = 'http://localhost';
const POSTS_DB = '0123456789abcdef0123456789abcdef';
const TAGS_DB = 'fedcba9876543210fedcba9876543210';
const TAGS_DS = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ENV = { NOTION_API_KEY: 'k', NOTION_POSTS_DATABASE_ID: POSTS_DB, NOTION_TAGS_DATABASE_ID: TAGS_DB, NOTION_DAILY_REPORT_DATABASE_ID: '' };

function getTags(env: Record<string, string> = ENV) {
  return app.request(`${ORIGIN}/api/tags`, {}, env);
}

function tagPage(id: string, name: string | null, titleKey = 'Name') {
  return {
    object: 'page',
    id,
    properties: {
      [titleKey]: { type: 'title', title: name === null ? [] : [{ plain_text: name }] },
      メモ: { type: 'rich_text', rich_text: [] },
    },
  };
}

// Notion SDK の通信を差し替える（実際の Notion には接続しない）
let notion: ReturnType<typeof vi.fn>;
beforeEach(() => {
  invalidateSchemaCache();
  notion = vi.fn();
  vi.spyOn(Client.prototype as any, 'request').mockImplementation(notion as any);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// タグ DB のクエリが pages の順にページングして返す偽クライアント
function mockTagsDb(pages: any[][]) {
  notion.mockImplementation(async ({ path, method, body }: any) => {
    if (method === 'get' && path === `databases/${TAGS_DB}`) return { data_sources: [{ id: TAGS_DS }] };
    if (method === 'post' && path === `data_sources/${TAGS_DS}/query`) {
      const index = body.start_cursor ? Number(body.start_cursor.replace('cursor-', '')) : 0;
      const hasMore = index < pages.length - 1;
      return { results: pages[index], has_more: hasMore, next_cursor: hasMore ? `cursor-${index + 1}` : null };
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
}

function queryCalls() {
  return notion.mock.calls.map(([args]: any) => args).filter((args: any) => args.path === `data_sources/${TAGS_DS}/query`);
}

describe('GET /api/tags', () => {
  it('100 件を超えるタグも全ページを取得し、名前順（数字は数値として比較）に並べて返す', async () => {
    const first = Array.from({ length: 100 }, (_, i) => tagPage(`p1-${i}`, `タグ${100 - i}`));
    const second = [tagPage('p2-0', 'Obsidian'), tagPage('p2-1', 'あいう'), tagPage('p2-2', 'タグ101')];
    mockTagsDb([first, second]);

    const res = await getTags({ ...ENV, NOTION_TAGS_LIMIT: '3' });
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.configured).toBe(true);
    expect(json.limit).toBe(3);
    expect(json.tags).toHaveLength(103);

    const names: string[] = json.tags.map((t: any) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ja', { numeric: true })));
    expect(names.slice(0, 2)).toEqual(['Obsidian', 'あいう']);
    expect(names.slice(-3)).toEqual(['タグ99', 'タグ100', 'タグ101']);
    expect(json.tags.find((t: any) => t.name === 'タグ1')).toEqual({ id: 'p1-99', name: 'タグ1' });

    expect(queryCalls().map((args: any) => args.body)).toEqual([
      { page_size: 100 },
      { start_cursor: 'cursor-1', page_size: 100 },
    ]);
  });

  it('タイトルの列名によらずタイトルを名前に使い、空なら「名称未設定」にする', async () => {
    mockTagsDb([[tagPage('t1', '日本語', '名前'), tagPage('t2', null)]]);

    const json: any = await (await getTags()).json();
    expect(json.tags).toEqual([
      { id: 't1', name: '日本語' },
      { id: 't2', name: '名称未設定' },
    ]);
    expect(json.limit).toBeNull();
  });

  it('タグ DB が未設定なら、Notion を呼ばずに空の一覧と configured: false を返す', async () => {
    for (const id of ['', '  ']) {
      const res = await getTags({ ...ENV, NOTION_TAGS_DATABASE_ID: id });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ tags: [], configured: false });
    }
    expect(notion).not.toHaveBeenCalled();
  });

  it('必須の環境変数が未設定なら 500 で、不足している変数名を返す', async () => {
    const res = await getTags({ ...ENV, NOTION_API_KEY: '' });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ missing: ['NOTION_API_KEY'] });
    expect(notion).not.toHaveBeenCalled();
  });

  it('Notion の取得に失敗したら、生のメッセージを返さず定型文に変換する', async () => {
    notion.mockRejectedValue(Object.assign(new Error('Could not find database with ID: secret-id'), { code: 'object_not_found' }));

    const res = await getTags();
    expect(res.status).toBe(404);
    const json: any = await res.json();
    expect(json).toEqual({ error: 'Failed to fetch tags', message: '対象が見つかりません' });
    expect(JSON.stringify(json)).not.toContain('secret-id');
  });
});
