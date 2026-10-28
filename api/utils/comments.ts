import type { Client, ListCommentsResponse, PageObjectResponse } from '@notionhq/client';
import { resolvePostsSchema } from './schema.ts';

/**
 * ページのコメントを has_more がなくなるまで取得する
 * - 安全弁として maxPages（既定 10 ページ = 1,000 件）で打ち切り、truncated で知らせる
 */
export async function listAllComments(
  notion: Pick<Client, 'comments'>,
  blockId: string,
  maxPages: number = 10
): Promise<{ results: ListCommentsResponse['results']; truncated: boolean }> {
  const results: ListCommentsResponse['results'] = [];
  let cursor: string | undefined = undefined;
  for (let i = 0; i < maxPages; i++) {
    const response: ListCommentsResponse = await notion.comments.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...response.results);
    if (!response.has_more || !response.next_cursor) return { results, truncated: false };
    cursor = response.next_cursor;
  }
  return { results, truncated: true };
}

/**
 * ページのコメント追加回数プロパティを更新または実数に同期する
 * - 呼び出し側で取得済みのページ（prefetchedPage）があれば使い回し、pages.retrieve を省略する
 */
export async function syncCommentsCount(
  notion: Client,
  pageId: string,
  actualCount: number,
  prefetchedPage?: PageObjectResponse
): Promise<number | undefined> {
  try {
    // 取得したページは従来どおり形を確かめずに使う（properties がなければ例外になり、catch で undefined を返す）
    const page = prefetchedPage ?? ((await notion.pages.retrieve({ page_id: pageId })) as PageObjectResponse);
    const countKey = resolvePostsSchema(page.properties).commentsCountKey;
    if (!countKey) return undefined;

    const countProperty = page.properties[countKey];
    const storedCount =
      countProperty?.type === 'number' && typeof countProperty.number === 'number'
        ? countProperty.number
        : 0;

    if (storedCount !== actualCount) {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          [countKey]: {
            number: actualCount,
          },
        },
      });
    }

    return actualCount;
  } catch (err: unknown) {
    console.warn(`[comments] Failed to sync commentsCount for page ${pageId}:`, err);
    return undefined;
  }
}

/**
 * ページのコメント追加回数プロパティを 1 インクリメントする
 * - 呼び出し側で取得済みのページ（prefetchedPage）があれば使い回し、pages.retrieve を省略する
 */
export async function incrementCommentsCount(
  notion: Client,
  pageId: string,
  prefetchedPage?: PageObjectResponse
): Promise<number | undefined> {
  try {
    // 取得したページは従来どおり形を確かめずに使う（properties がなければ例外になり、catch で undefined を返す）
    const page = prefetchedPage ?? ((await notion.pages.retrieve({ page_id: pageId })) as PageObjectResponse);
    const countKey = resolvePostsSchema(page.properties).commentsCountKey;
    if (!countKey) return undefined;

    const countProperty = page.properties[countKey];
    const currentCount =
      countProperty?.type === 'number' && typeof countProperty.number === 'number'
        ? countProperty.number
        : 0;

    const updatedCount = currentCount + 1;
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [countKey]: {
          number: updatedCount,
        },
      },
    });

    return updatedCount;
  } catch (err: unknown) {
    console.warn(`[comments] Failed to increment commentsCount for page ${pageId}:`, err);
    return undefined;
  }
}
