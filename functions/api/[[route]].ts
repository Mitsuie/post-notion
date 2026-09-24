import { handle } from 'hono/cloudflare-pages';
import { app } from '../../api/app.ts';

export const onRequest = handle(app);
