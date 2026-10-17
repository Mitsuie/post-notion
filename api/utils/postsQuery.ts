import type { PostsSchema } from './schema.ts';
import { isNotionId } from './validate.ts';

/**
 * GET /api/posts のクエリパラメータを Notion の dataSources.query 条件へ変換する
 */

export type PostsQueryParams = {
  from?: string; // 作成日時の下限（ISO 8601）
  to?: string; // 作成日時の上限（ISO 8601）
  tags: string[]; // いずれかを含む（OR 条件）
  order: 'desc' | 'asc';
  pin: boolean; // ピン留めを先頭に並べる
  q?: string; // タイトルに含むキーワード
  cursor?: string;
};

// キーワードの最大文字数
export const MAX_KEYWORD_LENGTH = 100;

// タグ条件の最大件数（Notion の compound filter の要素数上限 100 を下回るように制限）
export const MAX_TAG_FILTERS = 50;

function parseDate(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/**
 * クエリ文字列を検証して PostsQueryParams に変換する（不正な値は無視する）
 */
export function parsePostsQueryParams(query: Record<string, string | undefined>): PostsQueryParams {
  const tags = (query.tags ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id && isNotionId(id))
    .slice(0, MAX_TAG_FILTERS);

  return {
    from: parseDate(query.from),
    to: parseDate(query.to),
    tags,
    order: query.order === 'asc' ? 'asc' : 'desc',
    pin: query.pin === '1',
    q: Array.from(query.q?.trim() ?? '').slice(0, MAX_KEYWORD_LENGTH).join('') || undefined,
    cursor: query.cursor?.trim() || undefined,
  };
}

/**
 * PostsQueryParams とスキーマから dataSources.query の filter / sorts / start_cursor を組み立てる（純粋関数）
 * - 条件は and で結合する。タグは OR 条件
 * - タグ条件があるのにタグプロパティが存在しない場合は null（該当なし）を返す
 * - キーワードはタイトルの contains（Notion は大文字小文字を区別しない）
 */
export function buildPostsQuery(
  params: PostsQueryParams,
  schema: Partial<Pick<PostsSchema, 'titleKey' | 'tagsKey' | 'pinnedKey'>>
): { filter?: any; sorts: any[]; start_cursor?: string } | null {
  const conditions: any[] = [];

  if (params.from) {
    conditions.push({ timestamp: 'created_time', created_time: { on_or_after: params.from } });
  }
  if (params.to) {
    conditions.push({ timestamp: 'created_time', created_time: { on_or_before: params.to } });
  }
  if (params.tags.length > 0) {
    if (!schema.tagsKey) return null;
    const tagsKey = schema.tagsKey;
    conditions.push({
      or: params.tags.map((id) => ({ property: tagsKey, relation: { contains: id } })),
    });
  }

  if (params.q && schema.titleKey) {
    conditions.push({ property: schema.titleKey, title: { contains: params.q } });
  }

  const direction = params.order === 'asc' ? 'ascending' : 'descending';
  const sorts: any[] = [];
  if (params.pin && schema.pinnedKey) {
    sorts.push({ property: schema.pinnedKey, direction: 'descending' });
  }
  sorts.push({ timestamp: 'created_time', direction });

  return {
    ...(conditions.length > 0 ? { filter: { and: conditions } } : {}),
    sorts,
    ...(params.cursor ? { start_cursor: params.cursor } : {}),
  };
}
