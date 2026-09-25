import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Pin, MessageCircle, MessageSquarePlus, Clock, Loader2, ChevronDown, ChevronUp, FileText, ExternalLink, Calendar } from 'lucide-react';
import type { Post, Tag } from '../types';
import { usePostBlocks } from '../hooks/usePostBlocks';
import { PostComments } from './PostComments';
import { formatDate, formatFullDate } from '../utils/date';

interface PostCardProps {
  post: Post;
  availableTags: Tag[];
  onTogglePin?: (id: string, pinned: boolean) => void;
}

export function PostCard({
  post,
  availableTags,
  onTogglePin,
}: PostCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number>(post.commentsCount ?? 0);

  // 詳細展開時のみオンデマンドで本文Markdownを取得
  const { data: blocksData, isLoading: isBlocksLoading } = usePostBlocks(showDetails ? post.id : null);


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
          {/* ピン留め動的トグルボタン */}
          <button
            type="button"
            onClick={() => onTogglePin?.(post.id, !post.pinned)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: post.pinned ? 'var(--pinned-bg)' : 'var(--bg-tertiary)',
              color: post.pinned ? 'var(--pinned-color)' : 'var(--text-secondary)',
              border: `1px solid ${post.pinned ? 'var(--pinned-border)' : 'var(--border-color)'}`,
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={post.pinned ? 'ピン固定を解除' : 'ピン留めして上部に固定'}
          >
            <Pin size={11} style={{ fill: post.pinned ? 'currentColor' : 'none' }} />
            {post.pinned ? '固定中' : '固定'}
          </button>

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
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}
              title={formatFullDate(post.createdTime)}
            >
              <Clock size={12} /> {formatDate(post.createdTime)}
            </span>
          )}
        </div>
      </div>

      {/* 本文タイトル */}
      <div
        style={{
          fontSize: '0.95rem',
          lineHeight: 1.6,
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          marginBottom: resolvedTags.length > 0 ? '10px' : '8px',
        }}
      >
        {post.title}
      </div>

      {/* タグ一覧バッジ */}
      {resolvedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {resolvedTags.map((name, i) => (
            <span
              key={i}
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
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

      {/* 本文Markdownブロック展開エリア */}
      {showDetails && (
        <div
          style={{
            margin: '10px 0 12px',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={13} /> 本文
            </span>
          </div>

          {isBlocksLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', padding: '12px 0' }}>
              <Loader2 size={14} className="animate-spin" /> 本文ブロックを取得中...
            </div>
          ) : blocksData?.markdown && blocksData.markdown.trim() ? (
            <div className="markdown-content" style={{ overflowX: 'auto' }}>
              <ReactMarkdown>{blocksData.markdown}</ReactMarkdown>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', margin: '4px 0' }}>
              本文ブロックはありません（Notion側で本文を追加するとここにMarkdown表示されます）。
            </p>
          )}
        </div>
      )}

      {/* 下部アクションバー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* 詳細展開ボタン */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: showDetails ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              borderRadius: 'var(--radius-sm)',
              transition: 'color 0.15s ease',
              fontWeight: showDetails ? 600 : 400,
            }}
          >
            <FileText size={13} />
            <span>{showDetails ? '本文を閉じる' : '本文を表示'}</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* 日報連携マーク */}
          {post.dailyReport && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3px 5px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--accent-primary)',
                background: 'var(--accent-light)',
                lineHeight: 1,
              }}
              title="日報連携済み (DB_日報)"
            >
              <Calendar size={13} />
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 1. Notionで開く */}
          {(post.url || post.id) && (
            <a
              href={post.url || `https://notion.so/${post.id.replace(/-/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                fontWeight: 400,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title="Notion公式ページを新しいタブで開く"
            >
              <ExternalLink size={13} />
              <span>Notionで開く</span>
            </a>
          )}

          {/* 2. 返信一覧ボタン */}
          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            style={{
              background: showComments ? 'var(--accent-light)' : 'none',
              border: 'none',
              color: showComments || commentsCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.15s ease',
              fontWeight: showComments ? 600 : commentsCount > 0 ? 500 : 400,
            }}
            onMouseEnter={(e) => {
              if (!showComments) e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (!showComments) {
                e.currentTarget.style.color = commentsCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)';
              }
            }}
            title="返信コメント一覧を表示/非表示"
          >
            <MessageCircle
              size={13}
              style={{ color: commentsCount > 0 || showComments ? 'var(--accent-primary)' : undefined }}
            />
            <span>返信一覧{commentsCount > 0 ? ` (${commentsCount})` : ''}</span>
          </button>

          {/* 3. 返信（入力欄）ボタン */}
          <button
            type="button"
            onClick={() => setShowReplyForm((prev) => !prev)}
            style={{
              background: showReplyForm ? 'var(--accent-light)' : 'none',
              border: 'none',
              color: showReplyForm ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.15s ease',
              fontWeight: showReplyForm ? 600 : 400,
            }}
            onMouseEnter={(e) => {
              if (!showReplyForm) e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (!showReplyForm) e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="この投稿に返信を作成"
          >
            <MessageSquarePlus size={13} />
            <span>返信</span>
          </button>
        </div>
      </div>

      {/* 返信フォームおよびコメントスレッド一覧 */}
      <PostComments
        postId={post.id}
        isOptimistic={post.isOptimistic}
        showComments={showComments}
        onCloseComments={() => setShowComments(false)}
        showReplyForm={showReplyForm}
        onOpenReplyForm={() => setShowReplyForm(true)}
        onCloseReplyForm={() => setShowReplyForm(false)}
        onCommentsCountChange={setCommentsCount}
      />
    </article>
  );
}
