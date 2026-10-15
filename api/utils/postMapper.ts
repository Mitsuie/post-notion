import type { PostItem } from '../types.ts';
import { resolvePostsSchema } from './schema.ts';

/**
 * Notion の Posts DB ページをタイムライン表示用の PostItem に変換する（純粋関数）
 */
export function mapPageToPost(page: any): PostItem {
  const props = page.properties;
  // ページのプロパティ定義から利用するプロパティ名を解決（API 呼び出しなし）
  const { titleKey, tagsKey, pinnedKey, dailyReportKey, commentsCountKey } =
    resolvePostsSchema(props);

  // Title（2,000 文字ごとに分割して保存したタイトルも全文表示できるよう、全要素を連結する）
  const title = (props[titleKey]?.title || []).map((t: any) => t.plain_text).join('');

  // Tags (Relation)
  const tagRelations = tagsKey ? props[tagsKey]?.relation || [] : [];
  const tags = tagRelations.map((rel: { id: string }) => ({
    id: rel.id,
    name: '', // 詳細名はクライアント側でタグ一覧から解決
  }));

  // Pinned
  const pinned = pinnedKey ? !!props[pinnedKey]?.checkbox : false;

  // Daily Report (Relation)
  const dailyRelations = dailyReportKey ? props[dailyReportKey]?.relation || [] : [];
  const dailyReport = dailyRelations.length > 0 ? { id: dailyRelations[0].id } : null;

  // Created By
  const createdBy = {
    id: page.created_by?.id || '',
    name: page.created_by?.name || 'User',
    avatarUrl: page.created_by?.avatar_url,
  };

  // Comments Count (Number)
  const commentsCount =
    commentsCountKey && typeof props[commentsCountKey]?.number === 'number'
      ? props[commentsCountKey].number
      : 0;

  return {
    id: page.id,
    title,
    createdTime: page.created_time,
    createdBy,
    tags,
    pinned,
    dailyReport,
    commentsCount,
    url: page.url,
  };
}
