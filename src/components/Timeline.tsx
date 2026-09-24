import { useState, useEffect, useMemo } from 'react';
import { Loader2, Inbox, RefreshCw, Pin, ArrowDown, ArrowUp } from 'lucide-react';
import type { Post, Tag } from '../types';
import { PostCard } from './PostCard';

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

  useEffect(() => {
    localStorage.setItem('post-notion-sort-order', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem('post-notion-sort-pin', String(pinPriority));
  }, [pinPriority]);

  // ソート処理（ピン留め優先ON/OFF & 新しい順/古い順）
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (pinPriority) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
      }
      const timeA = new Date(a.createdTime).getTime() || 0;
      const timeB = new Date(b.createdTime).getTime() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [posts, sortOrder, pinPriority]);

  return (
    <section>
      {/* タイムラインヘッダー & コントロールバー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          タイムライン
          {posts.length > 0 && (
            <span style={{ fontSize: '0.8rem', marginLeft: '6px', color: 'var(--text-muted)' }}>
              (全{posts.length}件)
            </span>
          )}
        </h2>

        {/* ソート & フィルタ & 更新コントロール */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

      {/* ローディング表示 */}
      {isLoading && posts.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : sortedPosts.length === 0 ? (
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
          <Inbox size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            まだ投稿がありません
          </p>
          <p style={{ fontSize: '0.8rem' }}>
            上の入力欄から、思いついたことを0秒でメモしてみましょう。
          </p>
        </div>
      ) : (
        /* 投稿カード一覧（フラットタイムライン表示） */
        <div>
          {sortedPosts.map((post) => (
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
