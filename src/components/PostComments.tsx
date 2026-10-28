import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { MarkdownView } from './MarkdownView';
import { MessageCircle, Send, X, User, Loader2 } from 'lucide-react';
import { usePostComments, useCreateComment } from '../hooks/usePostComments';
import { formatDate, formatFullDate } from '../utils/date';
import { useToast } from './Toast';

interface PostCommentsProps {
  postId: string;
  isOptimistic?: boolean;
  showComments: boolean;
  onCloseComments: () => void;
  showReplyForm: boolean;
  onOpenReplyForm: () => void;
  onCloseReplyForm: () => void;
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
}: PostCommentsProps) {
  const [replyText, setReplyText] = useState('');
  const toast = useToast();

  // コメント展開または返信フォーム表示時のみオンデマンドでコメント一覧を取得
  const shouldFetchComments = showComments || showReplyForm;
  const { data: commentsData, isLoading: isCommentsLoading } = usePostComments(
    shouldFetchComments && !isOptimistic ? postId : null
  );

  // コメント投稿ミューテーション（楽観的更新付き）
  const createCommentMutation = useCreateComment(postId);

  const commentsList = commentsData?.comments || [];

  // コメント（返信）送信ハンドラ
  const handleReplySubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || createCommentMutation.isPending) return;

    createCommentMutation.mutate(
      { text: trimmed },
      {
        // 成功時のみ入力を消してフォームを閉じる（失敗時は入力を残す）
        onSuccess: () => {
          setReplyText('');
          onCloseReplyForm();
        },
        onError: () => {
          toast.error('コメントの送信に失敗しました（入力内容は残っています）');
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
        <form onSubmit={handleReplySubmit} className="post-comments__form">
          <div className="post-comments__form-header">
            <span>返信・コメントを作成 (改行可 / Cmd+Enter で即送信)</span>
            <button
              type="button"
              onClick={onCloseReplyForm}
              aria-label="返信フォームを閉じる"
              className="post-comments__form-close"
            >
              <X size={13} />
            </button>
          </div>

          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleReplyKeyDown}
            placeholder="返信や考察メモを入力 (改行可、Markdown対応)..."
            aria-label="返信・コメント"
            rows={3}
            className="input-field input-comment post-comments__input"
            autoFocus
          />

          <div className="post-comments__form-actions">
            <button type="button" onClick={onCloseReplyForm} className="post-comments__cancel">
              閉じる
            </button>
            <button
              type="submit"
              disabled={!replyText.trim() || createCommentMutation.isPending}
              className={`post-comments__submit${replyText.trim() ? ' post-comments__submit--ready' : ''}`}
            >
              {createCommentMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              送信する
            </button>
          </div>
        </form>
      )}

      {/* Notionコメントスレッド一覧（オンデマンド表示） */}
      {showComments && (
        <div className="post-comments__thread">
          <div className="post-comments__thread-header">
            <span className="post-comments__thread-title">
              <MessageCircle size={12} /> コメントスレッド ({commentsList.length}件)
            </span>
            <div className="post-comments__thread-actions">
              {!showReplyForm && (
                <button type="button" onClick={onOpenReplyForm} className="post-comments__add-reply">
                  + 返信を追加
                </button>
              )}
              <button type="button" onClick={onCloseComments} className="post-comments__thread-close">
                スレッドを閉じる
              </button>
            </div>
          </div>

          {/* コメント読み込み中 */}
          {isCommentsLoading ? (
            <div className="post-comments__loading">
              <Loader2 size={13} className="animate-spin" /> Notionからコメントを取得中...
            </div>
          ) : commentsList.length === 0 ? (
            /* コメントなし */
            <p className="post-comments__empty">
              まだコメントはありません。上のフォームから返信や考察を追記できます。
            </p>
          ) : (
            /* コメントリスト（時系列スレッド） */
            <div className="post-comments__list">
              {commentsList.map((c) => (
                <div
                  key={c.id}
                  className={`post-comments__item${c.isOptimistic ? ' post-comments__item--optimistic' : ''}`}
                >
                  <div className="post-comments__meta">
                    <div className="post-comments__author">
                      <User size={11} />
                      <span>{c.createdBy?.name || 'User'}</span>
                    </div>
                    <div>
                      {c.isOptimistic ? (
                        <span className="post-comments__sending">
                          <Loader2 size={10} className="animate-spin" /> 送信中...
                        </span>
                      ) : (
                        <span title={formatFullDate(c.createdTime)}>{formatDate(c.createdTime)}</span>
                      )}
                    </div>
                  </div>
                  <div className="markdown-content post-comments__body">
                    <MarkdownView>{c.text}</MarkdownView>
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
