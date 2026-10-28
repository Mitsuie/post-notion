import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '@notionhq/client';
import { app } from '../app.ts';

const ORIGIN = 'http://localhost';
const POSTS_DB = '0123456789abcdef0123456789abcdef';
const TAGS_DB = 'fedcba9876543210fedcba9876543210';
const DAILY_DB = '00000000111111112222222233333333';
const POSTS_DS = 'aaaaaaaa-0000-0000-0000-000000000001';
const TAGS_DS = 'aaaaaaaa-0000-0000-0000-000000000002';
const DAILY_DS = 'aaaaaaaa-0000-0000-0000-000000000003';
const ENV = {
  NOTION_API_KEY: 'k',
  NOTION_POSTS_DATABASE_ID: POSTS_DB,
  NOTION_TAGS_DATABASE_ID: TAGS_DB,
  NOTION_DAILY_REPORT_DATABASE_ID: DAILY_DB,
};

function getStatus(env: Record<string, string> = ENV) {
  return app.request(`${ORIGIN}/api/status`, {}, env);
}

// Notion SDK の通信を差し替える（実際の Notion には接続しない）
let notion: ReturnType<typeof vi.fn>;
beforeEach(() => {
  notion = vi.fn();
  vi.spyOn(Client.prototype as any, 'request').mockImplementation(notion as any);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// 3 つの DB がそろった偽クライアント（failPath に一致する通信だけ失敗させる）
function mockDatabases(failPath?: { path: string; error: Error }) {
  const databases: Record<string, { title: string; dataSources: string[] }> = {
    [POSTS_DB]: { title: 'ポスト', dataSources: [POSTS_DS] },
    [TAGS_DB]: { title: 'タグ一覧', dataSources: [TAGS_DS] },
    [DAILY_DB]: { title: '日報', dataSources: [DAILY_DS, 'aaaaaaaa-0000-0000-0000-000000000004'] },
  };
  const properties: Record<string, Record<string, { type: string }>> = {
    [POSTS_DS]: { Name: { type: 'title' }, タグ: { type: 'relation' }, ピン留め: { type: 'checkbox' }, 無関係: { type: 'number' } },
    [TAGS_DS]: { Name: { type: 'title' } },
    [DAILY_DS]: { 日付: { type: 'date' }, 名前: { type: 'title' } },
  };
  notion.mockImplementation(async ({ path, method }: any) => {
    if (failPath && path === failPath.path) throw failPath.error;
    const [kind, id, action] = path.split('/');
    if (method === 'get' && kind === 'databases' && databases[id]) {
      const db = databases[id];
      return { title: [{ plain_text: db.title }], data_sources: db.dataSources.map((dsId) => ({ id: dsId })) };
    }
    if (method === 'get' && kind === 'data_sources' && !action && properties[id]) return { properties: properties[id] };
    if (method === 'post' && kind === 'data_sources' && action === 'query') {
      const results = id === TAGS_DS ? [{ id: 'tag-1' }, { id: 'tag-2' }] : [];
      return { results, has_more: false, next_cursor: null };
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
}

describe('GET /api/status: DB 未設定時', () => {
  it('必須の環境変数が未設定なら、Notion を呼ばずに status: error と不足している変数名を返す', async () => {
    const res = await getStatus({ ...ENV, NOTION_API_KEY: '', NOTION_POSTS_DATABASE_ID: ' ' });
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json).toMatchObject({
      status: 'error',
      environment: { configured: false, missing: ['NOTION_API_KEY', 'NOTION_POSTS_DATABASE_ID'] },
      postsDb: { connected: false, error: '環境変数が未設定です' },
      tagsDb: { connected: false, configured: true, error: '環境変数が未設定です' },
      dailyReportDb: { connected: false, configured: true, error: '環境変数が未設定です' },
    });
    expect(json.timestamp).toEqual(expect.any(String));
    expect(notion).not.toHaveBeenCalled();
  });

  it('必須の環境変数もタグ DB・日報 DB も未設定なら、任意の DB は未設定として返す', async () => {
    const json: any = await (
      await getStatus({ NOTION_API_KEY: '', NOTION_POSTS_DATABASE_ID: '', NOTION_TAGS_DATABASE_ID: '', NOTION_DAILY_REPORT_DATABASE_ID: '' })
    ).json();
    expect(json.status).toBe('error');
    expect(json.tagsDb).toEqual({ connected: false, configured: false });
    expect(json.dailyReportDb).toEqual({ connected: false, configured: false, title: '日報DB' });
    expect(notion).not.toHaveBeenCalled();
  });

  it('タグ DB・日報 DB が未設定なら、その DB を呼ばずに status: ok を返す', async () => {
    mockDatabases();
    const json: any = await (await getStatus({ ...ENV, NOTION_TAGS_DATABASE_ID: '', NOTION_DAILY_REPORT_DATABASE_ID: '  ' })).json();
    expect(json.status).toBe('ok');
    expect(json.postsDb.connected).toBe(true);
    expect(json.tagsDb).toEqual({ connected: false, configured: false, title: 'タグDB' });
    expect(json.dailyReportDb).toEqual({ connected: false, configured: false, title: '日報DB' });
    const paths = notion.mock.calls.map(([args]: any) => args.path);
    expect(paths.some((p: string) => p.includes(TAGS_DB) || p.includes(TAGS_DS) || p.includes(DAILY_DB))).toBe(false);
  });
});

describe('GET /api/status: 接続確認', () => {
  it('すべての DB に接続できれば status: ok で、ID はマスクし、使用中のプロパティとタグ件数を返す', async () => {
    mockDatabases();
    const json: any = await (await getStatus()).json();
    expect(json.status).toBe('ok');
    expect(json.environment).toEqual({ configured: true, notionApiKeyConfigured: true });
    expect(json.postsDb).toEqual({
      connected: true,
      title: 'ポスト',
      idMasked: '0123...cdef',
      properties: ['Name', 'タグ', 'ピン留め'],
      accessible: true,
    });
    expect(json.tagsDb).toMatchObject({ connected: true, configured: true, title: 'タグ一覧', idMasked: 'fedc...3210', tagsCount: 2 });
    expect(json.dailyReportDb).toMatchObject({
      connected: true,
      configured: true,
      title: '日報',
      properties: ['日付', '名前'],
      warning: 'データソースが 2 件あるため、先頭のデータソースを使用しています',
    });
    expect(JSON.stringify(json)).not.toContain(POSTS_DB);
  });

  it('接続に失敗した DB があれば status: degraded で、Notion の生のメッセージを返さない', async () => {
    mockDatabases({
      path: `data_sources/${TAGS_DS}/query`,
      error: Object.assign(new Error('SECRET internal detail'), { code: 'unauthorized' }),
    });
    const json: any = await (await getStatus()).json();
    expect(json.status).toBe('degraded');
    expect(json.postsDb.connected).toBe(true);
    expect(json.dailyReportDb.connected).toBe(true);
    expect(json.tagsDb).toEqual({
      connected: false,
      configured: true,
      idMasked: 'fedc...3210',
      error: 'Notion への接続権限がありません。インテグレーション設定を確認してください',
    });
    expect(JSON.stringify(json)).not.toContain('SECRET');
  });
});
