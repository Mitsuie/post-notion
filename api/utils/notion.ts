/**
 * Notion API関連の共通ユーティリティ
 */
import type { Client, QueryDataSourceParameters, QueryDataSourceResponse } from '@notionhq/client';

/**
 * dataSources.query を has_more がなくなるまで繰り返し、全件を取得するヘルパー
 * - data_source_id は schema.ts の getDataSourceId でデータベース ID から解決して渡す
 * - 1 ページ 100 件 × 最大 maxPages ページ（既定 10 ページ = 1,000 件）で打ち切る安全弁付き
 */
export async function queryAll(
  notion: Pick<Client, 'dataSources'>,
  args: Omit<QueryDataSourceParameters, 'start_cursor' | 'page_size'>,
  maxPages: number = 10
): Promise<QueryDataSourceResponse['results']> {
  const results: QueryDataSourceResponse['results'] = [];
  let cursor: string | undefined = undefined;
  for (let i = 0; i < maxPages; i++) {
    const response: QueryDataSourceResponse = await notion.dataSources.query({
      ...args,
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...response.results);
    if (!response.has_more || !response.next_cursor) break;
    cursor = response.next_cursor;
  }
  return results;
}

/**
 * Notion データベースのプロパティキーを候補名と型から自動検出するヘルパー
 * 1. 候補名との完全一致（大文字小文字無視）を優先探索
 * 2. 見つからない場合、allowTypeFallback が true（既定）なら type に一致する最初のプロパティキーを返却
 *    - 同じ型の列が複数ありうる場合（relation・checkbox・number など）は false を指定し、無関係な列を拾わないようにする
 */
export function findPropertyKey(
  properties: Record<string, any>,
  candidateNames: readonly string[],
  type: string,
  { allowTypeFallback = true }: { allowTypeFallback?: boolean } = {}
): string | undefined {
  // 1. 完全一致（大文字小文字無視）
  for (const name of candidateNames) {
    const found = Object.keys(properties).find(
      (k) => k.toLowerCase() === name.toLowerCase() && properties[k].type === type
    );
    if (found) return found;
  }
  // 2. タイプ一致の最初のもの
  if (!allowTypeFallback) return undefined;
  return Object.keys(properties).find((k) => properties[k].type === type);
}

/**
 * 環境変数 NOTION_TAGS_LIMIT からタグリレーションの選択上限を解決するヘルパー
 * - 正の整数のみ有効。未指定・不正値は null（無制限）として扱う
 */
export function parseTagsLimit(raw?: string): number | null {
  const n = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Post-Notion で利用される DB_Post-Notion のプロパティ定義一覧
 */
export const POSTS_DB_USED_PROPERTY_DEFINITIONS = [
  {
    name: 'タイトル',
    candidates: ['Title', 'タイトル', '名前', 'Name'],
    type: 'title',
    allowTypeFallback: true, // title型はNotion DBに1つのみ存在
  },
  {
    name: 'タグ',
    candidates: ['Tags', 'タグ'],
    type: 'relation',
    allowTypeFallback: false,
  },
  {
    name: 'ピン留め',
    candidates: ['ピン止め', 'ピン留め', '固定', 'Pinned'],
    type: 'checkbox',
    allowTypeFallback: false,
  },
  {
    name: '日報リレーション',
    candidates: ['DB_日報', '日報', 'Daily Report', 'デイリー'],
    type: 'relation',
    allowTypeFallback: false,
  },
  {
    name: 'コメント追加回数',
    candidates: ['コメント追加回数', 'Comments Count', 'コメント数', 'comments_count'],
    type: 'number',
    allowTypeFallback: false,
  },
  {
    name: '作成日時',
    candidates: ['作成日時', '作成日', 'Created time', 'Created Time'],
    type: 'created_time',
    allowTypeFallback: true,
  },
  {
    name: '作成者',
    candidates: ['作成者', 'Created by', 'Created By'],
    type: 'created_by',
    allowTypeFallback: true,
  },
] as const;

type PostsPropertyName = (typeof POSTS_DB_USED_PROPERTY_DEFINITIONS)[number]['name'];

/**
 * POSTS_DB_USED_PROPERTY_DEFINITIONS の定義（候補名・型・型フォールバック可否）に従ってプロパティキーを解決するヘルパー
 * - 実際の読み書き（schema.ts の resolvePostsSchema）と接続状況画面の表示（filterUsedPostsProperties）の両方がこれを使う
 */
export function findPostsPropertyKey(properties: Record<string, any>, name: PostsPropertyName): string | undefined {
  const def = POSTS_DB_USED_PROPERTY_DEFINITIONS.find((d) => d.name === name)!;
  return findPropertyKey(properties, def.candidates, def.type, { allowTypeFallback: def.allowTypeFallback });
}

/**
 * DB_Post-Notion の全プロパティから、本アプリで利用しているプロパティ名のみを抽出するヘルパー
 */
export function filterUsedPostsProperties(properties: Record<string, any>): string[] {
  const usedKeySet = new Set<string>();

  for (const def of POSTS_DB_USED_PROPERTY_DEFINITIONS) {
    const key = findPostsPropertyKey(properties, def.name);
    if (key) {
      usedKeySet.add(key);
    }
  }

  // 元のデータベースのプロパティ定義順序を維持して返却
  return Object.keys(properties).filter((key) => usedKeySet.has(key));
}

