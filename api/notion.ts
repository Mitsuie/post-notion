import { Client } from '@notionhq/client';
import type { Bindings } from './types.ts';

export function getNotionClient(apiKey: string): Client {
  // v5 は `WorkerGlobalScope` の有無でブラウザを判定し、ブラウザではトークンの使用を拒否する。
  // Cloudflare Workers（workerd）にも `WorkerGlobalScope` が存在するため、指定しないと全 API が失敗する。
  // 本クライアントは BFF（サーバー側）でのみ生成し、トークンはクライアントへ配信されないため許可してよい
  return new Client({ auth: apiKey, dangerouslyAllowBrowser: true });
}

export function validateEnv(env: Bindings): { valid: boolean; missing: string[]; hasTagsDb: boolean; hasDailyReportDb: boolean } {
  const missing: string[] = [];
  if (!env.NOTION_API_KEY || !env.NOTION_API_KEY.trim()) missing.push('NOTION_API_KEY');
  if (!env.NOTION_POSTS_DATABASE_ID || !env.NOTION_POSTS_DATABASE_ID.trim()) missing.push('NOTION_POSTS_DATABASE_ID');
  const hasTagsDb = !!env.NOTION_TAGS_DATABASE_ID && env.NOTION_TAGS_DATABASE_ID.trim() !== '';
  const hasDailyReportDb = !!env.NOTION_DAILY_REPORT_DATABASE_ID && env.NOTION_DAILY_REPORT_DATABASE_ID.trim() !== '';
  return { valid: missing.length === 0, missing, hasTagsDb, hasDailyReportDb };
}
