import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { app as apiApp } from '../api/app.ts';
import type { Bindings } from '../api/types.ts';

const cwd = process.cwd();
const envPath = path.resolve(cwd, '.env');
const devVarsPath = path.resolve(cwd, '.dev.vars');

// 環境変数の読み込みヘルパー（リクエストごとに .dev.vars / .env の最新状態を反映）
function getLatestEnv(): Record<string, string | undefined> {
  let fileEnv: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    try {
      fileEnv = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
    } catch {}
  } else if (fs.existsSync(devVarsPath)) {
    try {
      fileEnv = dotenv.parse(fs.readFileSync(devVarsPath, 'utf-8'));
    } catch {}
  }

  return {
    ...process.env,
    ...fileEnv,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const serverApp = new Hono<{ Bindings: Bindings }>();

// 1. 環境変数の注入（最新の .dev.vars / .env を c.env に透過的に注入）
serverApp.use('*', async (c, next) => {
  const current = (c.env || {}) as Partial<Bindings>;
  const latest = getLatestEnv();

  // @ts-ignore
  c.env = {
    NOTION_API_KEY: (current.NOTION_API_KEY ?? latest.NOTION_API_KEY ?? '').trim(),
    NOTION_POSTS_DATABASE_ID: (current.NOTION_POSTS_DATABASE_ID ?? latest.NOTION_POSTS_DATABASE_ID ?? '').trim(),
    NOTION_TAGS_DATABASE_ID: (current.NOTION_TAGS_DATABASE_ID ?? latest.NOTION_TAGS_DATABASE_ID ?? '').trim(),
    NOTION_DAILY_REPORT_DATABASE_ID: (current.NOTION_DAILY_REPORT_DATABASE_ID ?? latest.NOTION_DAILY_REPORT_DATABASE_ID ?? '').trim(),
  };
  await next();
});

// 2. 共通BFF API ルートをマウント
serverApp.route('/', apiApp);

// 3. 静的ファイル配信 (dist ディレクトリ)
serverApp.use(
  '/*',
  serveStatic({
    root: path.relative(cwd, distDir),
  })
);

// 4. SPA フォールバック (API 以外のリクエストで静的ファイルが見つからない場合は index.html を返却)
serverApp.get('*', (c) => {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf-8');
    return c.html(html);
  }
  return c.text('Not Found (dist/index.html is missing. Run `npm run build` first)', 404);
});

// サーバー起動
const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Post-Notion Server running at http://localhost:${port}`);
console.log(`📁 Static assets served from: ${distDir}`);

serve({
  fetch: serverApp.fetch,
  port,
});
