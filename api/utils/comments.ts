import type { Client } from '@notionhq/client';
import { findPropertyKey } from './notion.ts';

const COMMENTS_COUNT_CANDIDATES = [
  'コメント追加回数',
  'Comments Count',
  'コメント数',
  'comments_count',
];

/**
 * ページのコメント追加回数プロパティを更新または実数に同期する
 */
export async function syncCommentsCount(
  notion: Client,
  pageId: string,
  actualCount: number
): Promise<number | undefined> {
  try {
    const page: any = await notion.pages.retrieve({ page_id: pageId });
    const countKey = findPropertyKey(page.properties, COMMENTS_COUNT_CANDIDATES, 'number');
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
 */
export async function incrementCommentsCount(
  notion: Client,
  pageId: string
): Promise<number | undefined> {
  try {
    const page: any = await notion.pages.retrieve({ page_id: pageId });
    const countKey = findPropertyKey(page.properties, COMMENTS_COUNT_CANDIDATES, 'number');
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
