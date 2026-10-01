import React, { useState, useRef, useEffect } from 'react';
import { Send, Pin, X, Calendar } from 'lucide-react';
import type { Tag, CreatePostInput } from '../types';
import { TagPicker } from './TagPicker';
import { useMarkdownShortcuts } from '../hooks/useMarkdownShortcuts';
import { useDraft } from '../hooks/useDraft';
import { getTodayLocalDateString } from '../utils/date';

interface InputBarProps {
  availableTags: Tag[];
  isTagsConfigured?: boolean;
  isDailyReportConfigured?: boolean;
  tagLimit?: number | null;
  defaultPinned?: boolean;
  defaultDailyReport?: boolean;
  requireTag?: boolean;
  onSubmit: (
    input: CreatePostInput,
    options?: { onError?: (err: unknown) => void; onSuccess?: () => void }
  ) => void;
  isSubmitting?: boolean;
}

export function InputBar({
  availableTags,
  isTagsConfigured = true,
  isDailyReportConfigured = true,
  tagLimit,
  defaultPinned = false,
  defaultDailyReport = true,
  requireTag = false,
  onSubmit,
  isSubmitting,
}: InputBarProps) {
  const [content, setContent] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(defaultPinned);
  const [linkDailyReport, setLinkDailyReport] = useState(isDailyReportConfigured && defaultDailyReport);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  // タグ選択の必須化判定（タグDB設定済みかつ登録タグが存在する場合のみ有効）
  const isTagRequired = Boolean(requireTag && isTagsConfigured && availableTags.length > 0);
  const isTitleEmpty = !content.trim();
  const isTagMissing = isTagRequired && selectedTags.length === 0;
  const isSubmitDisabled = isTitleEmpty || isTagMissing || Boolean(isSubmitting);

  // 入力が空（下書き入力前または送信後）の場合に設定変更をリアルタイム同期
  const isCleanInput = !content.trim() && !body.trim() && selectedTags.length === 0;

  useEffect(() => {
    if (isCleanInput) {
      setIsPinned(defaultPinned);
    }
  }, [defaultPinned, isCleanInput]);

  useEffect(() => {
    if (!isDailyReportConfigured) {
      setLinkDailyReport(false);
    } else if (isCleanInput) {
      setLinkDailyReport(defaultDailyReport);
    }
  }, [isDailyReportConfigured, defaultDailyReport, isCleanInput]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 下書き自動管理フック
  const { restoreDraft, saveDraft, clearDraft } = useDraft(availableTags);

  // 下書き（Draft）の自動復元
  useEffect(() => {
    restoreDraft((draft, matchedTags) => {
      if (draft.title && !content) setContent(draft.title);
      if (draft.body && !body) setBody(draft.body);
      if (typeof draft.pinned === 'boolean') {
        setIsPinned(draft.pinned);
      } else {
        setIsPinned(defaultPinned);
      }
      if (typeof draft.linkDailyReport === 'boolean') {
        setLinkDailyReport(isDailyReportConfigured ? draft.linkDailyReport : false);
      } else {
        setLinkDailyReport(isDailyReportConfigured ? defaultDailyReport : false);
      }
      if (matchedTags.length > 0) setSelectedTags(matchedTags);
    });
  }, [restoreDraft, content, body, isDailyReportConfigured, defaultPinned, defaultDailyReport]);

  // 下書き（Draft）の自動保存
  useEffect(() => {
    saveDraft({
      title: content,
      body,
      tagIds: selectedTags.map((t) => t.id),
      pinned: isPinned,
      linkDailyReport,
    });
  }, [content, body, selectedTags, isPinned, linkDailyReport, saveDraft]);

  // タイトル変更ハンドラ（改行はスペースに置換して禁止）
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value.replace(/[\r\n]+/g, ' ');
    setContent(newText);
  };

  // 送信処理（摩擦ゼロ: 即時クリア & フォーカス維持 + エラー時の安全復元）
  const handleSend = () => {
    const trimmedTitle = content.trim();
    if (!trimmedTitle) return;
    if (isTagRequired && selectedTags.length === 0) return;

    // クライアントのローカル日付（YYYY-MM-DD）
    const todayStr = getTodayLocalDateString();

    // 送信失敗時の復元用に現在の入力内容をバックアップ
    const pendingInput = {
      content,
      body,
      selectedTags: [...selectedTags],
      isPinned,
      linkDailyReport,
    };

    // 0秒クリア & フォーカス維持（軽快なUX）
    setContent('');
    setBody('');
    setSelectedTags([]);
    setIsPinned(defaultPinned);
    setLinkDailyReport(isDailyReportConfigured ? defaultDailyReport : false);
    clearDraft();

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 10);

    onSubmit(
      {
        title: trimmedTitle,
        body: body.trim() || undefined,
        tagIds: pendingInput.selectedTags.map((t) => t.id),
        pinned: pendingInput.isPinned,
        linkDailyReport: isDailyReportConfigured ? pendingInput.linkDailyReport : false,
        clientDate: todayStr,
      },
      {
        onError: () => {
          // 送信エラー発生時: バックアップから入力内容・下書きを完全復元
          setContent(pendingInput.content);
          setBody(pendingInput.body);
          setSelectedTags(pendingInput.selectedTags);
          setIsPinned(pendingInput.isPinned);
          setLinkDailyReport(pendingInput.linkDailyReport);
          saveDraft({
            title: pendingInput.content,
            body: pendingInput.body,
            tagIds: pendingInput.selectedTags.map((t) => t.id),
            pinned: pendingInput.isPinned,
            linkDailyReport: pendingInput.linkDailyReport,
          });
          setTimeout(() => {
            textareaRef.current?.focus();
          }, 10);
        },
      }
    );
  };

  // タイトル欄キーボードイベント (Cmd/Ctrl + Enter で送信、通常のEnterによる改行は禁止)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語IME等の変換確定時のEnterはスルー
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'Enter') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        handleSend();
      } else {
        // Notionタイトル用のため、通常のEnterキーによる改行を無効化
        e.preventDefault();
      }
    }
  };

  // 本文欄キーボードイベント（Markdown自動補完、Tab階層インデント、Cmd/Ctrl+Enter送信フック）
  const { handleKeyDown: handleBodyKeyDown } = useMarkdownShortcuts({
    textareaRef: bodyTextareaRef,
    onChange: setBody,
    onSend: handleSend,
  });

  // ペースト時にも改行をスペースに置換して挿入
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pasteText = e.clipboardData.getData('text');
    const sanitized = pasteText.replace(/[\r\n]+/g, ' ');
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updated = content.substring(0, start) + sanitized + content.substring(end);
    setContent(updated);

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + sanitized.length;
    }, 0);
  };

  const toggleTag = (tag: Tag) => {
    if (tagLimit === 1) {
      // 1件制限モード: 選択済みなら解除、別のタグなら置き換え
      if (selectedTags.some((t) => t.id === tag.id)) {
        setSelectedTags([]);
      } else {
        setSelectedTags([tag]);
      }
      return;
    }

    // 複数選択モード
    if (selectedTags.some((t) => t.id === tag.id)) {
      setSelectedTags(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div
      className="glass"
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        marginBottom: '24px',
        position: 'relative',
        zIndex: 10,
        boxShadow: 'var(--shadow-md)',
        transition: 'all 0.2s ease',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* テキスト入力エリア（タイトル用・改行禁止・ウィンドウ表示） */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="いま考えていること、タイトル... (改行不可 / Cmd+Enter で即送信)"
        rows={2}
        style={{
          width: '100%',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          lineHeight: 1.5,
          resize: 'none',
          fontFamily: 'inherit',
          outline: 'none',
          marginBottom: '8px',
          transition: 'border-color 0.15s ease',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
      />

      {/* 本文入力エリア（タイトル入力欄とタグ表示部分の間に新設） */}
      <textarea
        ref={bodyTextareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleBodyKeyDown}
        placeholder="本文・詳細メモ (任意、改行可、Markdown対応)..."
        rows={3}
        style={{
          width: '100%',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          resize: 'vertical',
          fontFamily: 'inherit',
          outline: 'none',
          marginTop: '0px',
          marginBottom: selectedTags.length > 0 ? '12px' : '8px',
          transition: 'border-color 0.15s ease',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
      />

      {/* 選択されたタグのバッジ（タイトル入力欄・本文欄の下に配置） */}
      {selectedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'var(--accent-light)',
                color: 'var(--accent-primary)',
                border: '1px solid var(--accent-border)',
              }}
            >
              #{tag.name}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* フッター操作バー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* タグ選択ボタン & ポップオーバー (タグDB設定時かつタグ存在時のみ表示) */}
          {isTagsConfigured && availableTags.length > 0 && (
            <TagPicker
              availableTags={availableTags}
              selectedTags={selectedTags}
              onToggleTag={toggleTag}
              isRequired={isTagRequired}
              limit={tagLimit}
            />
          )}

          {/* ピン留めトグルボタン */}
          <button
            type="button"
            className="mobile-icon-btn"
            onClick={() => setIsPinned(!isPinned)}
            style={{
              background: isPinned ? 'var(--pinned-bg)' : 'var(--bg-tertiary)',
              border: `1px solid ${isPinned ? 'var(--pinned-border)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              color: isPinned ? 'var(--pinned-color)' : 'var(--text-secondary)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={isPinned ? 'ピン固定を解除' : 'タイムライン最上部にピン固定'}
          >
            <Pin size={14} style={{ fill: isPinned ? 'currentColor' : 'none' }} />
            <span className="hide-on-mobile">{isPinned ? 'ピン固定中' : 'ピン留め'}</span>
            <span className="show-on-mobile" style={{ display: 'none' }}>固定</span>
          </button>

          {/* 日報紐付けトグルボタン (日報DB設定時のみ表示) */}
          {isDailyReportConfigured && (
            <button
              type="button"
              className="mobile-icon-btn"
              onClick={() => setLinkDailyReport(!linkDailyReport)}
              style={{
                background: linkDailyReport ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                border: `1px solid ${linkDailyReport ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                color: linkDailyReport ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: linkDailyReport ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={linkDailyReport ? '当日の日報ページに自動連携（クリックで解除）' : '日報への連携をスキップ（クリックで連携）'}
            >
              <Calendar size={14} />
              <span className="hide-on-mobile">{linkDailyReport ? '日報: ON' : '日報: OFF'}</span>
              <span className="show-on-mobile" style={{ display: 'none' }}>日報</span>
            </button>
          )}
        </div>

        {/* 送信ボタン（ユーザー指示により「投稿」文字を維持） */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSubmitDisabled}
          style={{
            background: !isSubmitDisabled ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: !isSubmitDisabled ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: !isSubmitDisabled ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            boxShadow: !isSubmitDisabled ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
            flexShrink: 0,
          }}
          title={
            isSubmitting
              ? '投稿中...'
              : isTitleEmpty
              ? 'タイトルを入力してください (Cmd/Ctrl + Enter)'
              : isTagMissing
              ? 'タグを1つ以上選択してください'
              : 'Notionへ投稿 (Cmd/Ctrl + Enter)'
          }
        >
          <Send size={14} /> 投稿
        </button>
      </div>
    </div>
  );
}
