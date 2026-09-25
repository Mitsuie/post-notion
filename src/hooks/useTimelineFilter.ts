import { useState, useMemo } from 'react';
import type { Post, Tag } from '../types';

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

// 作成日フィルター判定ヘルパー
export function matchesDateFilter(createdTime: string, filter: FilterState): boolean {
  if (filter.datePreset === 'all') return true;

  const postDate = new Date(createdTime);
  const now = new Date();

  switch (filter.datePreset) {
    case 'today': {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return postDate.getTime() >= todayStart;
    }
    case '7d': {
      const past7d = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return postDate.getTime() >= past7d;
    }
    case '30d': {
      const past30d = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      return postDate.getTime() >= past30d;
    }
    case 'custom': {
      if (!filter.customStartDate && !filter.customEndDate) return true;
      const postTime = postDate.getTime();
      if (filter.customStartDate) {
        const start = new Date(`${filter.customStartDate}T00:00:00`).getTime();
        if (postTime < start) return false;
      }
      if (filter.customEndDate) {
        const end = new Date(`${filter.customEndDate}T23:59:59.999`).getTime();
        if (postTime > end) return false;
      }
      return true;
    }
    default:
      return true;
  }
}

// タグフィルター判定ヘルパー（複数選択: OR条件）
export function matchesTagFilter(postTags: { id: string }[], selectedTagIds: string[]): boolean {
  if (selectedTagIds.length === 0) return true;
  return postTags.some((t) => selectedTagIds.includes(t.id));
}

interface UseTimelineFilterOptions {
  posts: Post[];
  availableTags: Tag[];
  sortOrder: 'desc' | 'asc';
  pinPriority: boolean;
}

export function useTimelineFilter({
  posts,
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

  // フィルタリング ＆ ソート処理
  const filteredAndSortedPosts = useMemo(() => {
    const filtered = posts.filter((post) => {
      const dateMatch = matchesDateFilter(post.createdTime, filter);
      const tagMatch = matchesTagFilter(post.tags, filter.selectedTagIds);
      return dateMatch && tagMatch;
    });

    return filtered.sort((a, b) => {
      if (pinPriority) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
      }
      const timeA = new Date(a.createdTime).getTime() || 0;
      const timeB = new Date(b.createdTime).getTime() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [posts, filter, sortOrder, pinPriority]);

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
    filteredAndSortedPosts,
    dateFilterLabel,
    handleToggleTag,
  };
}
