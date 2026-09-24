import { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Inbox,
  RefreshCw,
  Pin,
  ArrowDown,
  ArrowUp,
  Filter,
  Calendar,
  Tag as TagIcon,
  X,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { Post, Tag } from '../types';
import { PostCard } from './PostCard';

export type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

export interface FilterState {
  datePreset: DatePreset;
  customStartDate: string;
  customEndDate: string;
  selectedTagIds: string[];
}

const DEFAULT_FILTER: FilterState = {
  datePreset: '30d',
  customStartDate: '',
  customEndDate: '',
  selectedTagIds: [],
};

// 作成日フィルター判定ヘルパー
function matchesDateFilter(createdTime: string, filter: FilterState): boolean {
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
function matchesTagFilter(postTags: { id: string }[], selectedTagIds: string[]): boolean {
  if (selectedTagIds.length === 0) return true;
  return postTags.some((t) => selectedTagIds.includes(t.id));
}

interface TimelineProps {
  posts: Post[];
  availableTags: Tag[];
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onTogglePin?: (id: string, pinned: boolean) => void;
}

export function Timeline({
  posts,
  availableTags,
  isLoading,
  onRefresh,
  isRefreshing,
  onTogglePin,
}: TimelineProps) {
  // ソート設定（localStorageに保存して記憶）
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(() => {
    return (localStorage.getItem('post-notion-sort-order') as 'desc' | 'asc') || 'desc';
  });
  const [pinPriority, setPinPriority] = useState<boolean>(() => {
    return localStorage.getItem('post-notion-sort-pin') !== 'false';
  });

  // フィルター状態（初期値: 直近30日間、タグ選択なし）
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('post-notion-sort-order', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem('post-notion-sort-pin', String(pinPriority));
  }, [pinPriority]);

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

  return (
    <section>
      {/* タイムラインヘッダー & コントロールバー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          タイムライン
          {posts.length > 0 && (
            <span style={{ fontSize: '0.8rem', marginLeft: '6px', color: 'var(--text-muted)' }}>
              (表示{filteredAndSortedPosts.length}件 / 全{posts.length}件)
            </span>
          )}
        </h2>

        {/* ソート & フィルタ & 更新コントロール */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* フィルター開閉ボタン */}
          <button
            type="button"
            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
            style={{
              background: isFilterPanelOpen || isFiltered ? 'var(--accent-light)' : 'var(--bg-tertiary)',
              border: `1px solid ${isFilterPanelOpen || isFiltered ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              color: isFilterPanelOpen || isFiltered ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: isFiltered ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="タイムラインの絞り込み（作成日・タグ）"
          >
            <Filter size={11} />
            <span>フィルター{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>

          {/* ピン留め優先ON/OFFトグルボタン */}
          <button
            type="button"
            onClick={() => setPinPriority((prev) => !prev)}
            style={{
              background: pinPriority ? 'var(--pinned-bg)' : 'var(--bg-tertiary)',
              border: `1px solid ${pinPriority ? 'var(--pinned-border)' : 'var(--border-color)'}`,
              color: pinPriority ? 'var(--pinned-color)' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={pinPriority ? 'ピン固定優先: 有効 (クリックで無効化)' : 'ピン固定優先: 無効 (クリックで有効化)'}
          >
            <Pin size={11} style={{ fill: pinPriority ? 'currentColor' : 'none' }} />
            <span>固定優先: {pinPriority ? 'ON' : 'OFF'}</span>
          </button>

          {/* 新しい順 / 古い順 切り替えボタン */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={sortOrder === 'desc' ? '現在: 新しい順 (クリックで古い順へ)' : '現在: 古い順 (クリックで新しい順へ)'}
          >
            {sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
            <span>{sortOrder === 'desc' ? '新しい順' : '古い順'}</span>
          </button>

          {/* 更新ボタン */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading || isRefreshing}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: isLoading || isRefreshing ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 500,
              transition: 'all 0.15s ease',
              opacity: isLoading || isRefreshing ? 0.7 : 1,
            }}
            title="最新の投稿を読み込む"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span>更新</span>
          </button>
        </div>
      </div>

      {/* Notion風スライド展開フィルターパネル */}
      {isFilterPanelOpen && (
        <div
          className="glass"
          style={{
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            marginBottom: '12px',
            border: '1px solid var(--border-hover)',
            boxShadow: 'var(--shadow-md)',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* パネル上部ヘッダー */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              <Filter size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>フィルター設定</span>
            </div>
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="フィルター設定パネルを閉じる"
            >
              <X size={15} />
            </button>
          </div>

          {/* セクション1: 作成日フィルター */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} />
              <span>作成日 (Created Time)</span>
            </div>

            {/* 期間プリセットピルボタン群 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: filter.datePreset === 'custom' ? '10px' : 0 }}>
              {[
                { id: 'all' as DatePreset, label: 'すべて（全期間）' },
                { id: 'today' as DatePreset, label: '今日' },
                { id: '7d' as DatePreset, label: '直近7日' },
                { id: '30d' as DatePreset, label: '直近30日 (デフォルト)' },
                { id: 'custom' as DatePreset, label: '日付指定...' },
              ].map((preset) => {
                const isActive = filter.datePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setFilter((prev) => ({ ...prev, datePreset: preset.id }))}
                    style={{
                      background: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* カレンダー日付範囲指定ピッカー（「日付指定」選択時のみインライン表示） */}
            {filter.datePreset === 'custom' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-tertiary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>開始:</span>
                  <input
                    type="date"
                    value={filter.customStartDate}
                    onChange={(e) => setFilter((prev) => ({ ...prev, customStartDate: e.target.value }))}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '3px 6px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <span style={{ color: 'var(--text-muted)' }}>〜</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>終了:</span>
                  <input
                    type="date"
                    value={filter.customEndDate}
                    onChange={(e) => setFilter((prev) => ({ ...prev, customEndDate: e.target.value }))}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '3px 6px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      outline: 'none',
                    }}
                  />
                </div>
                {(filter.customStartDate || filter.customEndDate) && (
                  <button
                    type="button"
                    onClick={() => setFilter((prev) => ({ ...prev, customStartDate: '', customEndDate: '' }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      marginLeft: 'auto',
                    }}
                  >
                    クリア
                  </button>
                )}
              </div>
            )}
          </div>

          {/* セクション2: タグフィルター（複数選択可） */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TagIcon size={12} />
                <span>タグ (複数選択可・いずれかを含む)</span>
              </div>
              {filter.selectedTagIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter((prev) => ({ ...prev, selectedTagIds: [] }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    padding: 0,
                  }}
                >
                  タグ全解除 ({filter.selectedTagIds.length}件選択中)
                </button>
              )}
            </div>

            {/* タグ一覧（縦並びチェックリスト形式） */}
            {availableTags.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>利用可能なタグがありません</p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {availableTags.map((tag) => {
                  const isSelected = filter.selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      style={{
                        width: '100%',
                        background: isSelected ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: isSelected ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--bg-tertiary)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      {/* チェックボックス風アイコン */}
                      <span
                        style={{
                          width: '15px',
                          height: '15px',
                          borderRadius: '3px',
                          border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                          background: isSelected ? 'var(--accent-primary)' : 'var(--bg-card)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tag.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* パネル下部フッターアクション */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setFilter(DEFAULT_FILTER)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <RotateCcw size={11} />
                <span>デフォルト（直近30日）に戻す</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilter({
                    datePreset: 'all',
                    customStartDate: '',
                    customEndDate: '',
                    selectedTagIds: [],
                  })
                }
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                全条件をクリア
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(false)}
              style={{
                background: 'var(--accent-primary)',
                border: 'none',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              完了
            </button>
          </div>
        </div>
      )}

      {/* 適用中フィルター条件チップ（常時表示エリア） */}
      {isFiltered && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '12px',
            padding: '6px 10px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '0.75rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '2px' }}>
            <Filter size={11} />
            適用中:
          </span>

          {/* 作成日チップ */}
          {isDateFiltered && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-light)',
                color: 'var(--accent-primary)',
                fontWeight: 500,
                border: '1px solid rgba(var(--accent-primary-rgb, 59, 130, 246), 0.2)',
              }}
            >
              <Calendar size={11} />
              <span>作成日: {dateFilterLabel}</span>
              <button
                type="button"
                onClick={() => setFilter((prev) => ({ ...prev, datePreset: 'all' }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="作成日フィルターを解除（全期間表示）"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {/* 選択された各タグチップ */}
          {filter.selectedTagIds.map((tagId) => {
            const tagName = tagMap.get(tagId) || 'タグ';
            return (
              <span
                key={tagId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-light)',
                  color: 'var(--accent-primary)',
                  fontWeight: 500,
                  border: '1px solid rgba(var(--accent-primary-rgb, 59, 130, 246), 0.2)',
                }}
              >
                <TagIcon size={11} />
                <span>{tagName}</span>
                <button
                  type="button"
                  onClick={() => handleToggleTag(tagId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={`「${tagName}」の絞り込みを解除`}
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}

          {/* クイック操作ボタン */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(filter.datePreset !== '30d' || filter.selectedTagIds.length > 0) && (
              <button
                type="button"
                onClick={() => setFilter(DEFAULT_FILTER)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
                title="デフォルト（直近30日間・タグ全件）に戻す"
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <RotateCcw size={10} />
                <span>初期状態に戻す</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setFilter({
                  datePreset: 'all',
                  customStartDate: '',
                  customEndDate: '',
                  selectedTagIds: [],
                })
              }
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.75rem',
                textDecoration: 'underline',
              }}
              title="すべてのフィルターを解除して全投稿を表示"
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              すべて解除
            </button>
          </div>
        </div>
      )}

      {/* ローディング表示 */}
      {isLoading && posts.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filteredAndSortedPosts.length === 0 ? (
        /* Empty State */
        <div
          className="glass"
          style={{
            borderRadius: 'var(--radius-lg)',
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          {isFiltered && posts.length > 0 ? (
            /* フィルターによる該当なし */
            <>
              <Filter size={36} style={{ margin: '0 auto 12px', opacity: 0.5, color: 'var(--accent-primary)' }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                条件に一致する投稿が見つかりませんでした
              </p>
              <p style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
                {isDateFiltered && isTagFiltered
                  ? '選択した期間内に、指定のタグが付いた投稿が存在しません。'
                  : isDateFiltered
                  ? '指定した期間内に作成された投稿がありません。'
                  : '指定したタグが付いた投稿がありません。'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() =>
                    setFilter({
                      datePreset: 'all',
                      customStartDate: '',
                      customEndDate: '',
                      selectedTagIds: [],
                    })
                  }
                  style={{
                    background: 'var(--accent-primary)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  全期間・全タグを表示
                </button>
                <button
                  type="button"
                  onClick={() => setFilter(DEFAULT_FILTER)}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  直近30日に戻す
                </button>
              </div>
            </>
          ) : (
            /* 投稿データ自体が0件 */
            <>
              <Inbox size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                まだ投稿がありません
              </p>
              <p style={{ fontSize: '0.8rem' }}>
                上の入力欄から、思いついたことを0秒でメモしてみましょう。
              </p>
            </>
          )}
        </div>
      ) : (
        /* 投稿カード一覧（フラットタイムライン表示） */
        <div>
          {filteredAndSortedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              availableTags={availableTags}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </section>
  );
}

