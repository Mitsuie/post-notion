import { Hono } from 'hono';
import type { AppConfigResponse, Bindings } from '../types.ts';
import { validateEnv } from '../notion.ts';

export const configRouter = new Hono<{ Bindings: Bindings }>();

/**
 * 起動時に必要な設定（タグ DB・日報 DB が設定済みか）を返す
 * - 環境変数だけで判定し、Notion API は呼ばない（接続できるかの診断は /api/status で行う）
 * - API キー・Posts DB が未設定の場合はタグ・日報も使えないため、どちらも false を返す
 */
configRouter.get('/', (c) => {
  const { valid, hasTagsDb, hasDailyReportDb } = validateEnv(c.env);
  const body: AppConfigResponse = {
    tagsConfigured: valid && hasTagsDb,
    dailyReportConfigured: valid && hasDailyReportDb,
  };
  return c.json(body);
});
