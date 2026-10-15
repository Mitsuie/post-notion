import { useState, useMemo } from 'react';
import type { Tag } from '../types';

export type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

export interface FilterState {
  datePreset: DatePreset;
  customStartDate: string;
  customEndDate: string;
  selectedTagIds: string[];
}

export const DEFAULT_FILTER: FilterState = {
  datePreset: '30d',
  customStartDate: '',
  customEndDate: '',
  selectedTagIds: [],
};

// GET /api/posts に渡す絞り込み・並び順の条件（値はすべて文字列）
export interface PostsQueryParams {
  from?: string; // 作成日時の下限（ISO 8601）
  to?: string; // 作成日時の上限（ISO 8601）
  tags?: string; // タグIDのカンマ区切り（OR 条件）
  order: 'desc' | 'asc';
  pin: '1' | '0';
}

// ローカル日時文字列を ISO 8601 に変換する（不正な日付は undefined）
function toIsoOrUndefined(localDateTime: string): string | undefined {
  const date = new Date(localDateTime);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// ローカル日付の 0:00（days 日前）
function startOfLocalDay(now: Date, daysAgo = 0): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
}

/**
 * フィルター・並び順を GET /api/posts のクエリ条件へ変換する（純粋関数）
 * - プリセット（今日・7日・30日）の境界はローカル日付の 0:00 に丸める
 *   （現在時刻基準だとクエリキーが毎回変わりキャッシュが効かないため。「直近7日」は「7日前の 0:00 以降」）
 * - タグIDは並び順に依存しないよう並べ替えて連結する
 */
export function toPostsQueryParams(
  filter: FilterState,
  sortOrder: 'desc' | 'asc',
  pinPriority: boolean,
  now: Date
): PostsQueryParams {
  const params: PostsQueryParams = { order: sortOrder, pin: pinPriority ? '1' : '0' };

  switch (filter.datePreset) {
    case 'today':
      params.from = startOfLocalDay(now).toISOString();
      break;
    case '7d':
      params.from = startOfLocalDay(now, 7).toISOString();
      break;
    case '30d':
      params.from = startOfLocalDay(now, 30).toISOString();
      break;
    case 'custom': {
      const from = toIsoOrUndefined(`${filter.customStartDate}T00:00:00`);
      const to = toIsoOrUndefined(`${filter.customEndDate}T23:59:59.999`);
      if (filter.customStartDate && from) params.from = from;
      if (filter.customEndDate && to) params.to = to;
      break;
    }
    default:
      break;
  }

  if (filter.selectedTagIds.length > 0) {
    params.tags = [...filter.selectedTagIds].sort().join(',');
  }

  return params;
}

interface UseTimelineFilterOptions {
  availableTags: Tag[];
  sortOrder: 'desc' | 'asc';
  pinPriority: boolean;
}

export function useTimelineFilter({
  availableTags,
  sortOrder,
  pinPriority,
}: UseTimelineFilterOptions) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // タグ名解決用 Map
  const tagMap = useMemo(() => {
    return new Map(availableTags.map((t) => [t.id, t.name]));
  }, [availableTags]);

  // フィルター適用判定
  const isDateFiltered = filter.datePreset !== 'all';
  const isTagFiltered = filter.selectedTagIds.length > 0;
  const isFiltered = isDateFiltered || isTagFiltered;
  const activeFilterCount = (isDateFiltered ? 1 : 0) + (isTagFiltered ? 1 : 0);

  // サーバー側で絞り込み・並べ替えを行うためのクエリ条件
  const queryParams = useMemo(
    () => toPostsQueryParams(filter, sortOrder, pinPriority, new Date()),
    [filter, sortOrder, pinPriority]
  );

  // 作成日バッジ用ラベル文字列
  const dateFilterLabel = useMemo(() => {
    switch (filter.datePreset) {
      case 'today':
        return '今日';
      case '7d':
        return '直近7日';
      case '30d':
        return '直近30日';
      case 'custom':
        if (filter.customStartDate && filter.customEndDate) {
          return `${filter.customStartDate} 〜 ${filter.customEndDate}`;
        }
        if (filter.customStartDate) return `${filter.customStartDate} 〜`;
        if (filter.customEndDate) return `〜 ${filter.customEndDate}`;
        return '日付指定';
      default:
        return '';
    }
  }, [filter.datePreset, filter.customStartDate, filter.customEndDate]);

  // タグ選択トグル
  const handleToggleTag = (tagId: string) => {
    setFilter((prev) => {
      const exists = prev.selectedTagIds.includes(tagId);
      return {
        ...prev,
        selectedTagIds: exists
          ? prev.selectedTagIds.filter((id) => id !== tagId)
          : [...prev.selectedTagIds, tagId],
      };
    });
  };

  return {
    filter,
    setFilter,
    isFilterPanelOpen,
    setIsFilterPanelOpen,
    tagMap,
    isDateFiltered,
    isTagFiltered,
    isFiltered,
    activeFilterCount,
    queryParams,
    dateFilterLabel,
    handleToggleTag,
  };
}
