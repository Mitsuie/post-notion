import type { PostItem } from '../types.ts';
import { resolvePostsSchema } from './schema.ts';

// PostItem への変換で参照するプロパティ値の項目
type PostPropertyLike = {
  type: string;
  title?: Array<{ plain_text: string }>;
  relation?: Array<{ id: string }>;
  checkbox?: boolean;
  number?: number | null;
};

// PostItem への変換で参照するページの項目（SDK の PageObjectResponse もこの形を満たす）
type PostPageLike = {
  id: string;
  created_time: string;
  url?: string;
  // Notion の応答の created_by は id のみ。name・avatar_url は含まれていれば使う
  created_by?: { id?: string; name?: string; avatar_url?: string };
  properties: Record<string, PostPropertyLike>;
};

/**
 * Notion の Posts DB ページをタイムライン表示用の PostItem に変換する（純粋関数）
 */
export function mapPageToPost(page: PostPageLike): PostItem {
  const props = page.properties;
  // ページのプロパティ定義から利用するプロパティ名を解決（API 呼び出しなし）
  const { titleKey, tagsKey, pinnedKey, dailyReportKey, commentsCountKey } =
    resolvePostsSchema(props);

  // Title（2,000 文字ごとに分割して保存したタイトルも全文表示できるよう、全要素を連結する）
  const title = (props[titleKey]?.title || []).map((t) => t.plain_text).join('');

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
