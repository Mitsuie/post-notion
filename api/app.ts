import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import type { Bindings } from './types.ts';
import { tagsRouter } from './routes/tags.ts';
import { postsRouter } from './routes/posts.ts';
import { statusRouter } from './routes/status.ts';

export const app = new Hono<{ Bindings: Bindings }>();

// セキュリティ関連ヘッダー（public/_headers と同じ方針。Pages Functions の応答には _headers が適用されないため付与する）
export const SECURE_HEADERS_OPTIONS: NonNullable<Parameters<typeof secureHeaders>[0]> = {
  xFrameOptions: 'DENY',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
};

app.use('*', secureHeaders(SECURE_HEADERS_OPTIONS));

// CSRF 対策: フォーム由来の Content-Type での書き込みは同一オリジンのみ許可
app.use('/api/*', csrf());

// 書き込み系メソッドは JSON のみ受け付ける（HTML フォームから送れない形式に限定する）
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
app.use('/api/*', async (c, next) => {
  if (WRITE_METHODS.has(c.req.method)) {
    const contentType = c.req.header('content-type') || '';
    if (!/^application\/json\b/i.test(contentType)) {
      return c.json(
        { error: 'Unsupported Media Type', message: 'Content-Type には application/json を指定してください' },
        415
      );
    }
  }
  await next();
});

// Health Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'post-notion-bff',
  });
});

// Mount Routes
app.route('/api/tags', tagsRouter);
app.route('/api/posts', postsRouter);
app.route('/api/status', statusRouter);

export default app;
