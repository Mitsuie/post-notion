import { Pin, MessageCircle, Clock, Loader2 } from 'lucide-react';
import type { Post, Tag } from '../types';

interface PostCardProps {
  post: Post;
  availableTags: Tag[];
}

export function PostCard({ post, availableTags }: PostCardProps) {
  // 日時フォーマット (例: "9/23 00:45")
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    } catch {
      return isoString;
    }
  };

  // タグIDから名称を解決
  const resolvedTags = post.tags
    .map((t) => {
      const found = availableTags.find((at) => at.id === t.id);
      return found ? found.name : t.name || '';
    })
    .filter(Boolean);

  return (
    <article
      className="glass"
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        marginBottom: '12px',
        position: 'relative',
        transition: 'all 0.2s ease',
        opacity: post.isOptimistic ? 0.7 : 1,
        border: post.pinned
          ? '1px solid var(--pinned-border)'
          : '1px solid var(--border-color)',
        background: post.pinned
          ? 'var(--pinned-gradient)'
          : 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* 上部ヘッダー（作成者・ピン留め・日時） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* ピン留めバッジ */}
          {post.pinned && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--pinned-bg)',
                color: 'var(--pinned-color)',
                border: '1px solid var(--pinned-border)',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              <Pin size={11} style={{ fill: 'currentColor' }} /> 固定
            </span>
          )}

          {/* ユーザー名 */}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {post.createdBy?.name || 'ユーザー'}
          </span>
        </div>

        {/* 投稿日時 / 送信中ステータス */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {post.isOptimistic ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 500 }}>
              <Loader2 size={12} className="animate-spin" /> 送信中...
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
              <Clock size={12} /> {formatDate(post.createdTime)}
            </span>
          )}
        </div>
      </div>

      {/* 本文テキスト */}
      <div
        style={{
          fontSize: '0.95rem',
          lineHeight: 1.6,
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          marginBottom: resolvedTags.length > 0 ? '12px' : '6px',
        }}
      >
        {post.title}
      </div>

      {/* タグ一覧バッジ */}
      {resolvedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {resolvedTags.map((name, i) => (
            <span
              key={i}
              style={{
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                fontWeight: 500,
              }}
            >
              #{name}
            </span>
          ))}
        </div>
      )}

      {/* 下部アクションバー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 6px',
            borderRadius: 'var(--radius-sm)',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          title="スレッド返信 (Phase 2で詳細展開)"
        >
          <MessageCircle size={13} />
          <span>返信</span>
        </button>
      </div>
    </article>
  );
}
