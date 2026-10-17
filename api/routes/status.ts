import { Hono } from 'hono';
import type { Client } from '@notionhq/client';
import type { Bindings } from '../types.ts';
import { getNotionClient, validateEnv } from '../notion.ts';
import { filterUsedPostsProperties, queryAll } from '../utils/notion.ts';
import { pickDataSource } from '../utils/schema.ts';
import { toClientError } from '../utils/errors.ts';

// 接続確認の失敗理由を定型文に変換する（Notion の生メッセージは返さず、原因の切り分けに必要な粒度のみ残す）
function describeDbError(reason: unknown): string {
  console.error('[status] Notion database check failed:', reason);
  return toClientError(reason, 'データベースに接続できませんでした').message;
}

export const statusRouter = new Hono<{ Bindings: Bindings }>();

/**
 * データベースのタイトルと、使用するデータソースのプロパティ定義を取得する
 * - 診断用のため、スキーマキャッシュを使わず毎回 Notion に問い合わせる
 * - データソースが複数ある場合は先頭を使い、警告文を返す（schema.ts の getDataSourceId と同じ選び方）
 */
async function inspectDatabase(notion: Client, databaseId: string, fallbackTitle: string) {
  const db: any = await notion.databases.retrieve({ database_id: databaseId });
  const { dataSourceId, dataSourceCount } = pickDataSource(db, databaseId);
  const dataSource: any = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  return {
    title: db.title?.map((t: any) => t.plain_text).join('') || fallbackTitle,
    dataSourceId,
    properties: (dataSource.properties || {}) as Record<string, any>,
    warning:
      dataSourceCount > 1
        ? `データソースが ${dataSourceCount} 件あるため、先頭のデータソースを使用しています`
        : undefined,
  };
}

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
        configured: !!env.NOTION_TAGS_DATABASE_ID && env.NOTION_TAGS_DATABASE_ID.trim() !== '',
        error: (env.NOTION_TAGS_DATABASE_ID && env.NOTION_TAGS_DATABASE_ID.trim()) ? '環境変数が未設定です' : undefined,
      },
      dailyReportDb: {
        connected: false,
        configured: !!env.NOTION_DAILY_REPORT_DATABASE_ID && env.NOTION_DAILY_REPORT_DATABASE_ID.trim() !== '',
        title: '日報DB',
        error: (env.NOTION_DAILY_REPORT_DATABASE_ID && env.NOTION_DAILY_REPORT_DATABASE_ID.trim()) ? '環境変数が未設定です' : undefined,
      },
    });
  }

  const notion = getNotionClient(env.NOTION_API_KEY);

  // Posts DB, Tags DB, Daily Report DB の接続状況を並行取得
  const [postsDbResult, tagsDbResult, dailyReportDbResult] = await Promise.allSettled([
    (async () => {
      const db = await inspectDatabase(notion, env.NOTION_POSTS_DATABASE_ID, 'ポストDB');

      // 簡易疎通確認（クエリ実行の成否チェック）
      await notion.dataSources.query({ data_source_id: db.dataSourceId, page_size: 1 });

      return {
        connected: true,
        title: db.title,
        idMasked: maskId(env.NOTION_POSTS_DATABASE_ID),
        properties: filterUsedPostsProperties(db.properties),
        accessible: true,
        warning: db.warning,
      };
    })(),
    (async () => {
      if (!env.NOTION_TAGS_DATABASE_ID || !env.NOTION_TAGS_DATABASE_ID.trim()) {
        return {
          connected: false,
          configured: false,
          title: 'タグDB',
        };
      }
      const db = await inspectDatabase(notion, env.NOTION_TAGS_DATABASE_ID, 'タグDB');

      // 登録タグ件数を取得（100 件を超える場合も全ページを数える）
      const tagPages = await queryAll(notion, { data_source_id: db.dataSourceId });

      return {
        connected: true,
        configured: true,
        title: db.title,
        idMasked: maskId(env.NOTION_TAGS_DATABASE_ID),
        tagsCount: tagPages.length,
        accessible: true,
        warning: db.warning,
      };
    })(),
    (async () => {
      if (!env.NOTION_DAILY_REPORT_DATABASE_ID || !env.NOTION_DAILY_REPORT_DATABASE_ID.trim()) {
        return {
          connected: false,
          configured: false,
          title: '日報DB',
        };
      }
      const db = await inspectDatabase(notion, env.NOTION_DAILY_REPORT_DATABASE_ID, '日報DB');

      // 簡易疎通確認
      await notion.dataSources.query({ data_source_id: db.dataSourceId, page_size: 1 });

      return {
        connected: true,
        configured: true,
        title: db.title,
        idMasked: maskId(env.NOTION_DAILY_REPORT_DATABASE_ID),
        properties: Object.keys(db.properties),
        accessible: true,
        warning: db.warning,
      };
    })(),
  ]);

  const postsDb =
    postsDbResult.status === 'fulfilled'
      ? postsDbResult.value
      : {
          connected: false,
          idMasked: maskId(env.NOTION_POSTS_DATABASE_ID),
          error: describeDbError(postsDbResult.reason),
        };

  const hasTagsDb = !!env.NOTION_TAGS_DATABASE_ID && env.NOTION_TAGS_DATABASE_ID.trim() !== '';
  const tagsDb =
    tagsDbResult.status === 'fulfilled'
      ? tagsDbResult.value
      : {
          connected: false,
          configured: hasTagsDb,
          idMasked: maskId(env.NOTION_TAGS_DATABASE_ID),
          error: describeDbError(tagsDbResult.reason),
        };

  const hasDailyReportDb = !!env.NOTION_DAILY_REPORT_DATABASE_ID && env.NOTION_DAILY_REPORT_DATABASE_ID.trim() !== '';
  const dailyReportDb =
    dailyReportDbResult.status === 'fulfilled'
      ? dailyReportDbResult.value
      : {
          connected: false,
          configured: hasDailyReportDb,
          idMasked: maskId(env.NOTION_DAILY_REPORT_DATABASE_ID),
          error: describeDbError(dailyReportDbResult.reason),
        };

  const isAllOk = postsDb.connected && (tagsDb.connected || !hasTagsDb) && (dailyReportDb.connected || !hasDailyReportDb);

  return c.json({
    status: isAllOk ? 'ok' : 'degraded',
    timestamp: now,
    environment: {
      configured: true,
      notionApiKeyConfigured: true,
    },
    postsDb,
    tagsDb,
    dailyReportDb,
  });

});
