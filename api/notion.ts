import { Client } from '@notionhq/client';
import type { Bindings } from './types.ts';

export function getNotionClient(apiKey: string): Client {
  // 既定の node-fetch は nodejs_compat v2（compatibility_date 2024-09-23 以降）で default が解決できず失敗するため、
  // Workers・Node.js（18 以降）の双方にある標準 fetch を明示的に渡す
  return new Client({ auth: apiKey, fetch: (url, init) => fetch(url, init) });
}

export function validateEnv(env: Bindings): { valid: boolean; missing: string[]; hasTagsDb: boolean; hasDailyReportDb: boolean } {
  const missing: string[] = [];
  if (!env.NOTION_API_KEY || !env.NOTION_API_KEY.trim()) missing.push('NOTION_API_KEY');
  if (!env.NOTION_POSTS_DATABASE_ID || !env.NOTION_POSTS_DATABASE_ID.trim()) missing.push('NOTION_POSTS_DATABASE_ID');
  const hasTagsDb = !!env.NOTION_TAGS_DATABASE_ID && env.NOTION_TAGS_DATABASE_ID.trim() !== '';
  const hasDailyReportDb = !!env.NOTION_DAILY_REPORT_DATABASE_ID && env.NOTION_DAILY_REPORT_DATABASE_ID.trim() !== '';
  return { valid: missing.length === 0, missing, hasTagsDb, hasDailyReportDb };
}
