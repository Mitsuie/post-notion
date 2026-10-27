import type { Client, ListCommentsResponse } from '@notionhq/client';
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
  prefetchedPage?: any
): Promise<number | undefined> {
  try {
    const page: any = prefetchedPage ?? (await notion.pages.retrieve({ page_id: pageId }));
    const countKey = resolvePostsSchema(page.properties).commentsCountKey;
    if (!countKey) return undefined;

    const storedCount =
      typeof page.properties[countKey]?.number === 'number'
        ? page.properties[countKey].number
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
  prefetchedPage?: any
): Promise<number | undefined> {
  try {
    const page: any = prefetchedPage ?? (await notion.pages.retrieve({ page_id: pageId }));
    const countKey = resolvePostsSchema(page.properties).commentsCountKey;
    if (!countKey) return undefined;

    const currentCount =
      typeof page.properties[countKey]?.number === 'number'
        ? page.properties[countKey].number
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
