import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Pin, MessageCircle, MessageSquarePlus, Clock, Loader2, ChevronDown, ChevronUp, FileText, Send, X, ExternalLink, User } from 'lucide-react';
import type { Post, Tag } from '../types';
import { usePostBlocks } from '../hooks/usePostBlocks';
import { usePostComments, useCreateComment } from '../hooks/usePostComments';

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
  const [replyText, setReplyText] = useState('');

  // 詳細展開時のみオンデマンドで本文Markdownを取得
  const { data: blocksData, isLoading: isBlocksLoading } = usePostBlocks(showDetails ? post.id : null);

  // コメント展開または返信フォーム表示時のみオンデマンドでコメント一覧を取得
  const shouldFetchComments = showComments || showReplyForm;
  const { data: commentsData, isLoading: isCommentsLoading } = usePostComments(
    shouldFetchComments && !post.isOptimistic ? post.id : null
  );

  // コメント投稿ミューテーション（楽観的更新付き）
  const createCommentMutation = useCreateComment(post.id);

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

  // コメント（返信）送信ハンドラ
  const handleReplySubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || createCommentMutation.isPending) return;

    createCommentMutation.mutate(
      { text: trimmed },
      {
        onSuccess: () => {
          setReplyText('');
          setShowReplyForm(false);
          setShowComments(true);
        },
      }
    );
  };

  // コメント入力欄キーボード操作 (Cmd/Ctrl + Enter で即時送信、通常のEnterは改行)
  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleReplySubmit();
    }
  };

  const commentsList = commentsData?.comments || [];
  // フェッチ前はPostプロパティの「コメント追加回数」、フェッチ後は取得した最新の実数を反映
  const commentsCount =
    commentsData !== undefined ? commentsList.length : (post.commentsCount ?? 0);

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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
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

      {/* インライン返信・コメントフォーム */}
      {showReplyForm && (
        <form
          onSubmit={handleReplySubmit}
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px dashed var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>返信・コメントを作成 (改行可 / Cmd+Enter で即送信)</span>
            <button
              type="button"
              onClick={() => setShowReplyForm(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            >
              <X size={13} />
            </button>
          </div>

          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleReplyKeyDown}
            placeholder="返信や考察メモを入力 (改行可、Markdown対応)..."
            rows={3}
            autoFocus
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowReplyForm(false)}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={!replyText.trim() || createCommentMutation.isPending}
              style={{
                background: replyText.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: replyText.trim() ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 14px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: replyText.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {createCommentMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              送信する
            </button>
          </div>
        </form>
      )}

      {/* Notionコメントスレッド一覧（オンデマンド表示） */}
      {showComments && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MessageCircle size={12} /> コメントスレッド ({commentsCount}件)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!showReplyForm && (
                <button
                  type="button"
                  onClick={() => setShowReplyForm(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    padding: '2px 4px',
                  }}
                >
                  + 返信を追加
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowComments(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                スレッドを閉じる
              </button>
            </div>
          </div>

          {/* コメント読み込み中 */}
          {isCommentsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', padding: '12px 0', fontSize: '0.8rem' }}>
              <Loader2 size={13} className="animate-spin" /> Notionからコメントを取得中...
            </div>
          ) : commentsList.length === 0 ? (
            /* コメントなし */
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', margin: '6px 0' }}>
              まだコメントはありません。上のフォームから返信や考察を追記できます。
            </p>
          ) : (
            /* コメントリスト（時系列スレッド） */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {commentsList.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    opacity: c.isOptimistic ? 0.7 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <User size={11} />
                      <span>{c.createdBy?.name || 'User'}</span>
                    </div>
                    <div>
                      {c.isOptimistic ? (
                        <span style={{ color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Loader2 size={10} className="animate-spin" /> 送信中...
                        </span>
                      ) : (
                        <span>{formatDate(c.createdTime)}</span>
                      )}
                    </div>
                  </div>
                  <div className="markdown-content" style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    <ReactMarkdown>{c.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
