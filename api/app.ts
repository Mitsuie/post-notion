import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types.ts';
import { tagsRouter } from './routes/tags.ts';
import { postsRouter } from './routes/posts.ts';
import { statusRouter } from './routes/status.ts';

export const app = new Hono<{ Bindings: Bindings }>();

// CORS & Middleware
app.use('*', cors());

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
