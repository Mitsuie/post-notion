import type { Client } from '@notionhq/client';
import { findPropertyKey, POSTS_DB_USED_PROPERTY_DEFINITIONS } from './notion.ts';

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

// キーは データベースID（Node.js 構成で .env の DB ID を差し替えた場合も別エントリになる）
const postsSchemaCache = new Map<string, CacheEntry<PostsSchema>>();
const dailyReportDateKeyCache = new Map<string, CacheEntry<string>>();

function candidatesOf(name: (typeof POSTS_DB_USED_PROPERTY_DEFINITIONS)[number]['name']): readonly string[] {
  return POSTS_DB_USED_PROPERTY_DEFINITIONS.find((def) => def.name === name)!.candidates;
}

/**
 * Posts DB（またはそのページ）のプロパティ定義から、本アプリで使うプロパティ名を解決する（純粋関数）
 */
export function resolvePostsSchema(properties: Record<string, any>): PostsSchema {
  return {
    titleKey: findPropertyKey(properties, candidatesOf('タイトル'), 'title') || 'タイトル',
    tagsKey: findPropertyKey(properties, candidatesOf('タグ'), 'relation'),
    pinnedKey: findPropertyKey(properties, candidatesOf('ピン留め'), 'checkbox'),
    dailyReportKey: findPropertyKey(properties, candidatesOf('日報リレーション'), 'relation'),
    commentsCountKey: findPropertyKey(properties, candidatesOf('コメント追加回数'), 'number'),
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
 * Posts DB のプロパティ名を取得する（5分間キャッシュ。ミス時のみ databases.retrieve を呼ぶ）
 */
export async function getPostsSchema(notion: Client, databaseId: string): Promise<PostsSchema> {
  return getCached(postsSchemaCache, databaseId, async () => {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    return resolvePostsSchema(db.properties);
  });
}

/**
 * 日報 DB の日付プロパティ名を取得する（5分間キャッシュ）
 */
export async function getDailyReportDateKey(notion: Client, databaseId: string): Promise<string> {
  return getCached(dailyReportDateKeyCache, databaseId, async () => {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    return findPropertyKey(db.properties, ['日付', 'Date', '作成日'], 'date') || '日付';
  });
}

/**
 * スキーマキャッシュを破棄する（databaseId 省略時は全件）
 * - Notion 側でプロパティ名が変更され、旧名での書き込みが validation_error になった場合に呼ぶ
 */
export function invalidateSchemaCache(databaseId?: string): void {
  if (databaseId === undefined) {
    postsSchemaCache.clear();
    dailyReportDateKeyCache.clear();
    return;
  }
  postsSchemaCache.delete(databaseId);
  dailyReportDateKeyCache.delete(databaseId);
}

// Notion API の validation_error（プロパティ名の不一致などで発生する）かどうか
export function isValidationError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'validation_error';
}
