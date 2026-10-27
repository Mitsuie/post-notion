import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '@notionhq/client';
import { app } from '../app.ts';

const ORIGIN = 'http://localhost';
const BASE_ENV = { NOTION_API_KEY: 'k', NOTION_POSTS_DATABASE_ID: '0123456789abcdef0123456789abcdef' };

function getConfig(env: Record<string, string>) {
  return app.request(`${ORIGIN}/api/config`, { headers: { Origin: ORIGIN } }, env);
}

// Notion SDK の通信を差し替える（実際の Notion には接続しない）
let notion: ReturnType<typeof vi.fn>;
beforeEach(() => {
  notion = vi.fn();
  vi.spyOn(Client.prototype as any, 'request').mockImplementation(notion as any);
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/config', () => {
  it('タグ DB・日報 DB が設定済みなら true を返し、Notion を呼ばない', async () => {
    const res = await getConfig({
      ...BASE_ENV,
      NOTION_TAGS_DATABASE_ID: 'tags-db',
      NOTION_DAILY_REPORT_DATABASE_ID: 'daily-db',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tagsConfigured: true, dailyReportConfigured: true });
    expect(notion).not.toHaveBeenCalled();
  });

  it('未設定・空白のみは false を返し、Notion を呼ばない', async () => {
    const unset = await getConfig({ ...BASE_ENV });
    expect(await unset.json()).toEqual({ tagsConfigured: false, dailyReportConfigured: false });

    const blank = await getConfig({ ...BASE_ENV, NOTION_TAGS_DATABASE_ID: '  ', NOTION_DAILY_REPORT_DATABASE_ID: '' });
    expect(await blank.json()).toEqual({ tagsConfigured: false, dailyReportConfigured: false });

    expect(notion).not.toHaveBeenCalled();
  });

  it('片方だけ設定されている場合はそれぞれの値を返す', async () => {
    const tagsOnly = await getConfig({ ...BASE_ENV, NOTION_TAGS_DATABASE_ID: 'tags-db' });
    expect(await tagsOnly.json()).toEqual({ tagsConfigured: true, dailyReportConfigured: false });

    const dailyOnly = await getConfig({ ...BASE_ENV, NOTION_DAILY_REPORT_DATABASE_ID: 'daily-db' });
    expect(await dailyOnly.json()).toEqual({ tagsConfigured: false, dailyReportConfigured: true });

    expect(notion).not.toHaveBeenCalled();
  });
});
