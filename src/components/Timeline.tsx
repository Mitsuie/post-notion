import { Loader2, Inbox, RefreshCw } from 'lucide-react';
import type { Post, Tag } from '../types';
import { PostCard } from './PostCard';

interface TimelineProps {
  posts: Post[];
  availableTags: Tag[];
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function Timeline({ posts, availableTags, isLoading, onRefresh, isRefreshing }: TimelineProps) {
  // ピン留め投稿を最優先、続いて作成日時の新しい順にソート
  const sortedPosts = [...posts].sort((a, b) => {
    // 1. ピン留め優先
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // 2. 作成日時降順
    const timeA = new Date(a.createdTime).getTime() || 0;
    const timeB = new Date(b.createdTime).getTime() || 0;
    return timeB - timeA;
  });

  return (
    <section>
      {/* タイムラインヘッダー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          タイムライン
          {posts.length > 0 && (
            <span style={{ fontSize: '0.8rem', marginLeft: '6px', color: 'var(--text-muted)' }}>
              ({posts.length})
            </span>
          )}
        </h2>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || isRefreshing}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
          }}
          title="最新の投稿を読み込む"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>更新</span>
        </button>
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
        /* 投稿カード一覧 */
        <div>
          {sortedPosts.map((post) => (
            <PostCard key={post.id} post={post} availableTags={availableTags} />
          ))}
        </div>
      )}
    </section>
  );
}
