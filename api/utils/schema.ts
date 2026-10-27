import type { Client } from '@notionhq/client';
import { findPostsPropertyKey, findPropertyKey } from './notion.ts';

/**
 * Notion データベースのプロパティ名解決と、その期限付きキャッシュ
 * - キャッシュは isolate（Workers）/ プロセス（Node.js）単位のメモリ上に保持する
 * - 副作用のない読み取り結果のみをキャッシュするため、破棄されても問題ない
 */

export type PostsSchema = {
  titleKey: string;
  tagsKey?: string;
  pinnedKey?: string;
  dailyReportKey?: string;
  commentsCountKey?: string;
};

export const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAt: number };

// データベースが持つデータソース（Notion API 2025-09-03 以降、問い合わせとプロパティ定義はデータソース単位）
export type DataSourceInfo = { dataSourceId: string; dataSourceCount: number };

// キーは データベースID（Node.js 構成で .env の DB ID を差し替えた場合も別エントリになる）
const dataSourceCache = new Map<string, CacheEntry<DataSourceInfo>>();
const postsSchemaCache = new Map<string, CacheEntry<PostsSchema>>();
const dailyReportDateKeyCache = new Map<string, CacheEntry<string>>();

/**
 * Posts DB（またはそのページ）のプロパティ定義から、本アプリで使うプロパティ名を解決する（純粋関数）
 * - 型フォールバックは POSTS_DB_USED_PROPERTY_DEFINITIONS の allowTypeFallback に従う（タイトルのみ）
 */
export function resolvePostsSchema(properties: Record<string, any>): PostsSchema {
  return {
    titleKey: findPostsPropertyKey(properties, 'タイトル') || 'タイトル',
    tagsKey: findPostsPropertyKey(properties, 'タグ'),
    pinnedKey: findPostsPropertyKey(properties, 'ピン留め'),
    dailyReportKey: findPostsPropertyKey(properties, '日報リレーション'),
    commentsCountKey: findPostsPropertyKey(properties, 'コメント追加回数'),
  };
}

async function getCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const value = await load();
  cache.set(key, { value, expiresAt: Date.now() + SCHEMA_CACHE_TTL_MS });
  return value;
}

/**
 * databases.retrieve の応答から使用するデータソースを選ぶ（純粋関数）
 * - 本アプリが前提とする単一データソースのデータベースでは、その 1 件を使う
 * - 複数ある場合は先頭を使い、件数を返す（接続状況画面で警告するため）
 */
export function pickDataSource(database: unknown, databaseId: string): DataSourceInfo {
  const sources = (database as { data_sources?: Array<{ id: string }> } | null)?.data_sources ?? [];
  if (sources.length === 0) {
    throw new Error(`Database ${databaseId} has no data sources`);
  }
  return { dataSourceId: sources[0].id, dataSourceCount: sources.length };
}

/**
 * 環境変数のデータベース ID から、問い合わせに使うデータソース ID を解決する（5分間キャッシュ）
 */
export async function getDataSourceId(notion: Client, databaseId: string): Promise<string> {
  const info = await getCached(dataSourceCache, databaseId, async () =>
    pickDataSource(await notion.databases.retrieve({ database_id: databaseId }), databaseId)
  );
  return info.dataSourceId;
}

// データソースのプロパティ定義を取得する
async function retrieveDataSourceProperties(notion: Client, databaseId: string): Promise<Record<string, any>> {
  const dataSourceId = await getDataSourceId(notion, databaseId);
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  return (dataSource as { properties?: Record<string, any> }).properties ?? {};
}

/**
 * Posts DB のプロパティ名を取得する（5分間キャッシュ。ミス時のみ dataSources.retrieve を呼ぶ）
 */
export async function getPostsSchema(notion: Client, databaseId: string): Promise<PostsSchema> {
  return getCached(postsSchemaCache, databaseId, async () =>
    resolvePostsSchema(await retrieveDataSourceProperties(notion, databaseId))
  );
}

/**
 * 日報 DB の日付プロパティ名を取得する（5分間キャッシュ）
 */
export async function getDailyReportDateKey(notion: Client, databaseId: string): Promise<string> {
  return getCached(dailyReportDateKeyCache, databaseId, async () => {
    const properties = await retrieveDataSourceProperties(notion, databaseId);
    // 日報 DB は日付列が 1 つの構成が大半のため、型フォールバックを許可する
    return findPropertyKey(properties, ['日付', 'Date', '作成日'], 'date', { allowTypeFallback: true }) || '日付';
  });
}

/**
 * スキーマキャッシュを破棄する（databaseId 省略時は全件）
 * - Notion 側でプロパティ名が変更され、旧名での書き込みが validation_error になった場合に呼ぶ
 */
export function invalidateSchemaCache(databaseId?: string): void {
  if (databaseId === undefined) {
    dataSourceCache.clear();
    postsSchemaCache.clear();
    dailyReportDateKeyCache.clear();
    return;
  }
  dataSourceCache.delete(databaseId);
  postsSchemaCache.delete(databaseId);
  dailyReportDateKeyCache.delete(databaseId);
}

// Notion API の validation_error（プロパティ名の不一致などで発生する）かどうか
export function isValidationError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'validation_error';
}
