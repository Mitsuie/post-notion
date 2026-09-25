import { Hono } from 'hono';
import type { Bindings } from '../types.ts';
import { getNotionClient, validateEnv } from '../notion.ts';

export const statusRouter = new Hono<{ Bindings: Bindings }>();

// IDを安全にマスク表示（例: 3e32...85f0）
function maskId(id?: string): string {
  if (!id || id.length < 8) return '****';
  return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
}

statusRouter.get('/', async (c) => {
  const env = c.env;
  const validation = validateEnv(env);
  const now = new Date().toISOString();

  if (!validation.valid) {
    return c.json({
      status: 'error',
      timestamp: now,
      environment: {
        configured: false,
        missing: validation.missing,
      },
      postsDb: {
        connected: false,
        error: '環境変数が未設定です',
      },
      tagsDb: {
        connected: false,
        configured: !!env.NOTION_TAGS_DATABASE_ID,
        error: env.NOTION_TAGS_DATABASE_ID ? '環境変数が未設定です' : undefined,
      },
    });
  }

  const notion = getNotionClient(env.NOTION_API_KEY);

  // Posts DB, Tags DB, Daily Report DB の接続状況を並行取得
  const [postsDbResult, tagsDbResult, dailyReportDbResult] = await Promise.allSettled([
    (async () => {
      const db: any = await notion.databases.retrieve({
        database_id: env.NOTION_POSTS_DATABASE_ID,
      });
      const title = db.title?.map((t: any) => t.plain_text).join('') || 'ポストDB';
      const properties = Object.keys(db.properties || {});

      // 簡易疎通確認（クエリ実行の成否チェック）
      await notion.databases.query({
        database_id: env.NOTION_POSTS_DATABASE_ID,
        page_size: 1,
      });

      return {
        connected: true,
        title,
        idMasked: maskId(env.NOTION_POSTS_DATABASE_ID),
        properties,
        accessible: true,
      };
    })(),
    (async () => {
      if (!env.NOTION_TAGS_DATABASE_ID) {
        return {
          connected: false,
          configured: false,
          title: 'タグDB',
        };
      }
      const db: any = await notion.databases.retrieve({
        database_id: env.NOTION_TAGS_DATABASE_ID,
      });
      const title = db.title?.map((t: any) => t.plain_text).join('') || 'タグDB';

      // 登録タグ件数を取得
      const queryRes = await notion.databases.query({
        database_id: env.NOTION_TAGS_DATABASE_ID,
        page_size: 100,
      });

      return {
        connected: true,
        configured: true,
        title,
        idMasked: maskId(env.NOTION_TAGS_DATABASE_ID),
        tagsCount: queryRes.results.length,
        accessible: true,
      };
    })(),
    (async () => {
      if (!env.NOTION_DAILY_REPORT_DATABASE_ID) {
        return {
          connected: false,
          configured: false,
          error: '環境変数 NOTION_DAILY_REPORT_DATABASE_ID が未設定です',
        };
      }
      const db: any = await notion.databases.retrieve({
        database_id: env.NOTION_DAILY_REPORT_DATABASE_ID,
      });
      const title = db.title?.map((t: any) => t.plain_text).join('') || '日報DB';
      const properties = Object.keys(db.properties || {});

      // 簡易疎通確認
      await notion.databases.query({
        database_id: env.NOTION_DAILY_REPORT_DATABASE_ID,
        page_size: 1,
      });

      return {
        connected: true,
        configured: true,
        title,
        idMasked: maskId(env.NOTION_DAILY_REPORT_DATABASE_ID),
        properties,
        accessible: true,
      };
    })(),
  ]);

  const postsDb =
    postsDbResult.status === 'fulfilled'
      ? postsDbResult.value
      : {
          connected: false,
          idMasked: maskId(env.NOTION_POSTS_DATABASE_ID),
          error: (postsDbResult.reason as any)?.message || String(postsDbResult.reason),
        };

  const tagsDb =
    tagsDbResult.status === 'fulfilled'
      ? tagsDbResult.value
      : {
          connected: false,
          configured: !!env.NOTION_TAGS_DATABASE_ID,
          idMasked: maskId(env.NOTION_TAGS_DATABASE_ID),
          error: (tagsDbResult.reason as any)?.message || String(tagsDbResult.reason),
        };

  const dailyReportDb =
    dailyReportDbResult.status === 'fulfilled'
      ? dailyReportDbResult.value
      : {
          connected: false,
          idMasked: maskId(env.NOTION_DAILY_REPORT_DATABASE_ID),
          error: (dailyReportDbResult.reason as any)?.message || String(dailyReportDbResult.reason),
        };

  const isAllOk = postsDb.connected && (tagsDb.connected || !env.NOTION_TAGS_DATABASE_ID) && (dailyReportDb.connected || !env.NOTION_DAILY_REPORT_DATABASE_ID);

  return c.json({
    status: isAllOk ? 'ok' : 'degraded',
    timestamp: now,
    environment: {
      configured: true,
      notionApiKeyMasked: maskId(env.NOTION_API_KEY),
    },
    postsDb,
    tagsDb,
    dailyReportDb,
  });

});
