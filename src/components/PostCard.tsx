import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { MarkdownView } from './MarkdownView';
import { Pin, MessageCircle, MessageSquarePlus, Clock, Loader2, ChevronDown, ChevronUp, FileText, ExternalLink, Calendar, Trash2, Pencil } from 'lucide-react';
import type { Post, Tag } from '../types';
import { usePostBlocks } from '../hooks/usePostBlocks';
import { PostComments } from './PostComments';
import { PostActionsMenu, type PostActionsMenuItem } from './PostActionsMenu';
import { formatDate, formatFullDate } from '../utils/date';

interface PostCardProps {
  post: Post;
  availableTags: Tag[];
  onTogglePin?: (id: string, pinned: boolean) => void;
  onArchive?: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
}

export function PostCard({
  post,
  availableTags,
  onTogglePin,
  onArchive,
  onUpdateTitle,
}: PostCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  // コメント件数は ['posts'] キャッシュの値を直接表示する（コメント取得・投稿時に postsCache 経由で更新される）
  const commentsCount = post.commentsCount ?? 0;

  // タイトルのインライン編集
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const startEditTitle = () => {
    setTitleDraft(post.title);
    setIsEditingTitle(true);
  };
  const cancelEditTitle = () => setIsEditingTitle(false);
  const saveTitle = () => {
    const next = titleDraft.replace(/[\r\n]+/g, ' ').trim();
    setIsEditingTitle(false);
    if (next && next !== post.title) {
      onUpdateTitle?.(post.id, next);
    }
  };
  const handleTitleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語入力の変換確定の Enter では保存しない
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditTitle();
    }
  };

  // 「…」メニューの項目
  const menuItems: PostActionsMenuItem[] = [];
  if (onUpdateTitle) {
    menuItems.push({ label: 'タイトルを編集', icon: Pencil, onSelect: startEditTitle });
  }
  if (onArchive) {
    menuItems.push({
      label: '削除',
      icon: Trash2,
      danger: true,
      onSelect: () => {
        if (window.confirm('この投稿を削除しますか？（Notion のゴミ箱に移動し、30 日間は復元できます）')) {
          onArchive(post.id);
        }
      },
    });
  }

  // 詳細展開時のみオンデマンドで本文Markdownを取得
  const { data: blocksData, isLoading: isBlocksLoading } = usePostBlocks(showDetails ? post.id : null);


  // タグIDから名称を解決
  const resolvedTags = post.tags
    .map((t) => {
      const found = availableTags.find((at) => at.id === t.id);
      return found ? found.name : t.name || '';
    })
    .filter(Boolean);

  const cardClassName = [
    'glass post-card',
    post.pinned && 'post-card--pinned',
    post.isOptimistic && 'post-card--optimistic',
  ].filter(Boolean).join(' ');
  const titleBlockClassName = resolvedTags.length > 0
    ? 'post-card__title-block post-card__title-block--with-tags'
    : 'post-card__title-block';

  return (
    <article className={cardClassName}>
      {/* 上部ヘッダー（作成者・ピン留め・日時） */}
      <div className="post-card__header">
        <div className="post-card__header-start">
          {/* ピン留め動的トグルボタン */}
          <button
            type="button"
            onClick={() => onTogglePin?.(post.id, !post.pinned)}
            aria-pressed={post.pinned}
            className="post-card__pin"
            title={post.pinned ? 'ピン固定を解除' : 'ピン留めして上部に固定'}
          >
            <Pin size={11} />
            {post.pinned ? '固定中' : '固定'}
          </button>

          {/* ユーザー名 */}
          <span className="post-card__author">
            {post.createdBy?.name || 'ユーザー'}
          </span>
        </div>

        {/* 投稿日時 / 送信中ステータス */}
        <div className="post-card__meta">
          {post.isOptimistic ? (
            <span className="post-card__sending">
              <Loader2 size={12} className="animate-spin" /> 送信中...
            </span>
          ) : (
            <span className="post-card__time" title={formatFullDate(post.createdTime)}>
              <Clock size={12} /> {formatDate(post.createdTime)}
            </span>
          )}
        </div>
      </div>

      {/* 本文タイトル（「…」メニューから編集中はテキストエリアに置き換える） */}
      {isEditingTitle ? (
        <div className={titleBlockClassName}>
          <textarea
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            aria-label="タイトルを編集"
            rows={2}
            autoFocus
            className="input-title post-card__title-input"
          />
          <div className="post-card__title-actions">
            <span className="hide-on-mobile">Enter で保存 / Esc で取消</span>
            <button type="button" className="text-btn-muted" onClick={cancelEditTitle}>
              取消
            </button>
            <button type="button" className="text-btn-muted" onClick={saveTitle} disabled={!titleDraft.trim()}>
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className={`post-card__title ${titleBlockClassName}`}>
          {post.title}
        </div>
      )}

      {/* タグ一覧バッジ */}
      {resolvedTags.length > 0 && (
        <div className="post-card__tags">
          {resolvedTags.map((name, i) => (
            <span key={i} className="post-card__tag">
              #{name}
            </span>
          ))}
        </div>
      )}

      {/* 本文Markdownブロック展開エリア */}
      {showDetails && (
        <div className="post-card__details">
          <div className="post-card__details-header">
            <span className="post-card__details-label">
              <FileText size={13} /> 本文
            </span>
          </div>

          {isBlocksLoading ? (
            <div className="post-card__details-loading">
              <Loader2 size={14} className="animate-spin" /> 本文ブロックを取得中...
            </div>
          ) : blocksData?.markdown && blocksData.markdown.trim() ? (
            <div className="markdown-content post-card__markdown">
              <MarkdownView>{blocksData.markdown}</MarkdownView>
            </div>
          ) : (
            <p className="post-card__details-empty">
              本文ブロックはありません（Notion側で本文を追加するとここにMarkdown表示されます）。
            </p>
          )}
        </div>
      )}

      {/* 下部アクションバー */}
      <div className="post-card__footer">
        <div className="post-card__footer-start">
          {/* 詳細展開ボタン */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
            className="post-card__details-toggle"
          >
            <FileText size={13} />
            <span className="hide-on-mobile">{showDetails ? '本文を閉じる' : '本文を表示'}</span>
            <span className="show-on-mobile">{showDetails ? '閉じる' : '本文'}</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* 日報連携マーク */}
          {post.dailyReport && (
            <span className="post-card__daily-report" title="日報連携済み (DB_日報)">
              <Calendar size={13} />
            </span>
          )}
        </div>

        <div className="post-card__footer-end">
          {/* 1. Notionで開く */}
          {(post.url || post.id) && (
            <a
              href={post.url || `https://notion.so/${post.id.replace(/-/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card-action-btn mobile-action-btn"
              title="Notion公式ページを新しいタブで開く"
            >
              <ExternalLink size={13} />
              <span className="hide-on-mobile">Notionで開く</span>
              <span className="show-on-mobile">Notion</span>
            </a>
          )}

          {/* 2. 返信一覧ボタン */}
          <button
            type="button"
            className={`card-action-btn mobile-action-btn post-card__thread-btn${commentsCount > 0 ? ' post-card__thread-btn--has-comments' : ''}`}
            onClick={() => setShowComments((prev) => !prev)}
            aria-expanded={showComments}
            title="返信コメント一覧を表示/非表示"
          >
            <MessageCircle size={13} />
            <span className="hide-on-mobile">返信一覧</span>
            <span className="show-on-mobile">返信</span>
            {commentsCount > 0 && <span>({commentsCount})</span>}
          </button>

          {/* 3. 返信（入力欄）ボタン */}
          <button
            type="button"
            className="card-action-btn mobile-action-btn post-card__thread-btn"
            onClick={() => setShowReplyForm((prev) => !prev)}
            aria-expanded={showReplyForm}
            title="この投稿に返信を作成"
          >
            <MessageSquarePlus size={13} />
            <span className="hide-on-mobile">返信</span>
            <span className="show-on-mobile">返信</span>
          </button>

          {/* 4. その他の操作（送信中の未確定投稿では表示しない） */}
          {!post.isOptimistic && menuItems.length > 0 && <PostActionsMenu items={menuItems} />}
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
      />
    </article>
  );
}
