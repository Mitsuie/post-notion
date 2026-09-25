import { useState, useEffect } from 'react';
import {
  Loader2,
  Inbox,
  RefreshCw,
  Pin,
  ArrowDown,
  ArrowUp,
  Filter,
} from 'lucide-react';
import type { Post, Tag } from '../types';
import { PostCard } from './PostCard';
import { TimelineFilterModal } from './TimelineFilterModal';
import { ActiveFilterChips } from './ActiveFilterChips';
import { useTimelineFilter, DEFAULT_FILTER } from '../hooks/useTimelineFilter';

export type { DatePreset, FilterState } from '../hooks/useTimelineFilter';

interface TimelineProps {
  posts: Post[];
  availableTags: Tag[];
  isTagsConfigured?: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onTogglePin?: (id: string, pinned: boolean) => void;
}

export function Timeline({
  posts,
  availableTags,
  isTagsConfigured = true,
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

  useEffect(() => {
    localStorage.setItem('post-notion-sort-order', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem('post-notion-sort-pin', String(pinPriority));
  }, [pinPriority]);

  // タイムラインフィルター＆ソートのカスタムフック
  const {
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
  } = useTimelineFilter({
    posts,
    availableTags,
    sortOrder,
    pinPriority,
  });

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
      <TimelineFilterModal
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filter={filter}
        setFilter={setFilter}
        availableTags={availableTags}
        isTagsConfigured={isTagsConfigured}
        onToggleTag={handleToggleTag}
      />

      {/* 適用中フィルター条件チップ（常時表示エリア） */}
      <ActiveFilterChips
        isFiltered={isFiltered}
        isDateFiltered={isDateFiltered}
        dateFilterLabel={dateFilterLabel}
        selectedTagIds={filter.selectedTagIds}
        tagMap={tagMap}
        onClearDateFilter={() => setFilter((prev) => ({ ...prev, datePreset: 'all' }))}
        onToggleTag={handleToggleTag}
        onResetDefault={() => setFilter(DEFAULT_FILTER)}
        onClearAll={() =>
          setFilter({
            datePreset: 'all',
            customStartDate: '',
            customEndDate: '',
            selectedTagIds: [],
          })
        }
        showResetDefault={filter.datePreset !== '30d' || filter.selectedTagIds.length > 0}
      />

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
