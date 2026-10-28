/**
 * リクエスト値の検証ユーティリティ
 */
import type { PageObjectResponse } from '@notionhq/client';

const NOTION_ID_PATTERN =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Notion のページ・データベースID形式（32桁の16進数、またはハイフン付き UUID 形式）か
export function isNotionId(id: string): boolean {
  return NOTION_ID_PATTERN.test(id);
}

// DB ID 比較用にハイフンを除去して小文字化する
export function normalizeId(id: string): string {
  return id.replace(/-/g, '').toLowerCase();
}

/**
 * リクエスト本文を JSON として読み取る（解析できない場合は null）
 */
export async function readJson<T>(c: { req: { json: () => Promise<unknown> } }): Promise<T | null> {
  try {
    const body = await c.req.json();
    return body !== null && typeof body === 'object' ? (body as T) : null;
  } catch {
    return null;
  }
}

// Posts DB に属さないページを操作しようとした場合のエラー（404 として扱う）
export class PostNotFoundError extends Error {
  readonly code = 'object_not_found';
  constructor(pageId: string) {
    super(`Page ${pageId} does not belong to the posts database`);
    this.name = 'PostNotFoundError';
  }
}

/**
 * ページを取得し、Posts DB に属することを確認する（属さなければ PostNotFoundError）
 * - 取得したページを返すので、呼び出し側で使い回せる
 */
export async function assertPostsPage(
  notion: { pages: { retrieve: (args: { page_id: string }) => Promise<unknown> } },
  pageId: string,
  postsDatabaseId: string
): Promise<PageObjectResponse> {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parentDatabaseId = (page as { parent?: { database_id?: unknown } } | null | undefined)?.parent?.database_id;
  if (typeof parentDatabaseId !== 'string' || normalizeId(parentDatabaseId) !== normalizeId(postsDatabaseId)) {
    throw new PostNotFoundError(pageId);
  }
  // parent を持つのは完全なページの応答のみ（PartialPageObjectResponse は object と id だけ）
  return page as PageObjectResponse;
}
