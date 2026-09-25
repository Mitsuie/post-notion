import { useState, useEffect } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, Send, X, User, Loader2 } from 'lucide-react';
import { usePostComments, useCreateComment } from '../hooks/usePostComments';

interface PostCommentsProps {
  postId: string;
  isOptimistic?: boolean;
  showComments: boolean;
  onCloseComments: () => void;
  showReplyForm: boolean;
  onOpenReplyForm: () => void;
  onCloseReplyForm: () => void;
  formatDate: (isoString: string) => string;
  formatFullDate: (isoString: string) => string;
  onCommentsCountChange?: (count: number) => void;
}

/**
 * 投稿に対するコメント（返信）スレッド表示および返信フォームコンポーネント
 */
export function PostComments({
  postId,
  isOptimistic,
  showComments,
  onCloseComments,
  showReplyForm,
  onOpenReplyForm,
  onCloseReplyForm,
  formatDate,
  formatFullDate,
  onCommentsCountChange,
}: PostCommentsProps) {
  const [replyText, setReplyText] = useState('');

  // コメント展開または返信フォーム表示時のみオンデマンドでコメント一覧を取得
  const shouldFetchComments = showComments || showReplyForm;
  const { data: commentsData, isLoading: isCommentsLoading } = usePostComments(
    shouldFetchComments && !isOptimistic ? postId : null
  );

  // コメント投稿ミューテーション（楽観的更新付き）
  const createCommentMutation = useCreateComment(postId);

  const commentsList = commentsData?.comments || [];

  // コメント数が取得できたら親コンポーネントへ通知してバッジを同期
  useEffect(() => {
    if (commentsData?.comments) {
      onCommentsCountChange?.(commentsData.comments.length);
    }
  }, [commentsData?.comments, onCommentsCountChange]);

  // コメント（返信）送信ハンドラ
  const handleReplySubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || createCommentMutation.isPending) return;

    createCommentMutation.mutate(
      { text: trimmed },
      {
        onSuccess: () => {
          setReplyText('');
          onCloseReplyForm();
        },
      }
    );
  };

  // コメント入力欄キーボード操作 (Cmd/Ctrl + Enter で即時送信、通常のEnterは改行)
  const handleReplyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleReplySubmit();
    }
  };

  if (!showComments && !showReplyForm) {
    return null;
  }

  return (
    <>
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
              onClick={onCloseReplyForm}
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
              onClick={onCloseReplyForm}
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
              <MessageCircle size={12} /> コメントスレッド ({commentsList.length}件)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!showReplyForm && (
                <button
                  type="button"
                  onClick={onOpenReplyForm}
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
                onClick={onCloseComments}
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
                        <span title={formatFullDate(c.createdTime)}>{formatDate(c.createdTime)}</span>
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
    </>
  );
}
