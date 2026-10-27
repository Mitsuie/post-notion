import { Hono } from 'hono';
import type { AppConfigResponse, Bindings } from '../types.ts';
import { validateEnv } from '../notion.ts';

export const configRouter = new Hono<{ Bindings: Bindings }>();

/**
 * 起動時に必要な設定（タグ DB・日報 DB が設定済みか）を返す
 * - 環境変数だけで判定し、Notion API は呼ばない（接続できるかの診断は /api/status で行う）
 */
configRouter.get('/', (c) => {
  const { hasTagsDb, hasDailyReportDb } = validateEnv(c.env);
  const body: AppConfigResponse = {
    tagsConfigured: hasTagsDb,
    dailyReportConfigured: hasDailyReportDb,
  };
  return c.json(body);
});
