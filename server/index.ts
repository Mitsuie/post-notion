import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { app as apiApp } from '../api/app.ts';
import type { Bindings } from '../api/types.ts';

// 環境変数の読み込み (.env を優先し、無ければ .dev.vars をフォールバック)
const cwd = process.cwd();
const envPath = path.resolve(cwd, '.env');
const devVarsPath = path.resolve(cwd, '.dev.vars');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(devVarsPath)) {
  dotenv.config({ path: devVarsPath });
} else {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const serverApp = new Hono<{ Bindings: Bindings }>();

// 1. 環境変数の注入（c.env に process.env を透過的に注入）
serverApp.use('*', async (c, next) => {
  const current = (c.env || {}) as Partial<Bindings>;
  // @ts-ignore
  c.env = {
    NOTION_API_KEY: current.NOTION_API_KEY ?? process.env.NOTION_API_KEY ?? '',
    NOTION_POSTS_DATABASE_ID: current.NOTION_POSTS_DATABASE_ID ?? process.env.NOTION_POSTS_DATABASE_ID ?? '',
    NOTION_TAGS_DATABASE_ID: current.NOTION_TAGS_DATABASE_ID ?? process.env.NOTION_TAGS_DATABASE_ID ?? '',
    NOTION_DAILY_REPORT_DATABASE_ID: current.NOTION_DAILY_REPORT_DATABASE_ID ?? process.env.NOTION_DAILY_REPORT_DATABASE_ID ?? '',
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
