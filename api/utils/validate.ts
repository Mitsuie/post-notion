/**
 * リクエスト値の検証ユーティリティ
 */

const NOTION_ID_PATTERN =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Notion のページ・データベースID形式（32桁の16進数、またはハイフン付き UUID 形式）か
export function isNotionId(id: string): boolean {
  return NOTION_ID_PATTERN.test(id);
}
