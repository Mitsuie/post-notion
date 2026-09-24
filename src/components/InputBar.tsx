import React, { useState, useRef, useEffect } from 'react';
import { Send, Pin, Hash, X, Search, Calendar } from 'lucide-react';
import type { Tag, CreatePostInput } from '../types';

interface InputBarProps {
  availableTags: Tag[];
  onSubmit: (input: CreatePostInput) => void;
  isSubmitting?: boolean;
}

export function InputBar({ availableTags, onSubmit, isSubmitting }: InputBarProps) {
  const [content, setContent] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [linkDailyReport, setLinkDailyReport] = useState(true);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  // タイトル変更ハンドラ（改行はスペースに置換して禁止）
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value.replace(/[\r\n]+/g, ' ');
    setContent(newText);
  };

  // 送信処理（摩擦ゼロ: 即時クリア & フォーカス維持）
  const handleSend = () => {
    const trimmedTitle = content.trim();
    if (!trimmedTitle) return;

    // クライアントのローカル日付（YYYY-MM-DD）
    const todayStr = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()).replace(/\//g, '-');

    onSubmit({
      title: trimmedTitle,
      body: body.trim() || undefined,
      tagIds: selectedTags.map((t) => t.id),
      pinned: isPinned,
      linkDailyReport,
      clientDate: todayStr,
    });

    // 0秒クリア & フォーカス維持
    setContent('');
    setBody('');
    setSelectedTags([]);
    setIsPinned(false);
    // 日報紐付けは「デフォルトで適用」のため、trueを維持
    setShowTagPicker(false);
    setTagSearchQuery('');

    // フォーカス維持
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 10);
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

  // 本文欄キーボードイベント (Markdown自動補完、Tab階層インデント、Cmd/Ctrl+Enter送信)
  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語IME等の変換確定時はスルー
    if (e.nativeEvent.isComposing) return;

    // 1. Cmd/Ctrl + Enter で送信
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
      return;
    }

    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    // 2. Tab / Shift + Tab による階層インデント制御（半角スペース2文字）
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const indent = '  '; // Notion/Markdown標準の半角スペース2文字

      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEndIndex = value.indexOf('\n', end);
      const actualLineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

      if (start === end) {
        // 単一カーソル（選択範囲なし）
        if (!e.shiftKey) {
          // Tab: 行頭にインデントを追加して階層を下げる
          const beforeLine = value.substring(0, lineStart);
          const afterLineStart = value.substring(lineStart);
          const newValue = beforeLine + indent + afterLineStart;
          setBody(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + indent.length;
          }, 0);
        } else {
          // Shift + Tab: 行頭のインデントを最大2文字削除（階層を上げる / アウトデント）
          const currentLine = value.substring(lineStart, actualLineEnd);
          let removedCount = 0;
          if (currentLine.startsWith('  ')) {
            removedCount = 2;
          } else if (currentLine.startsWith(' ') || currentLine.startsWith('\t')) {
            removedCount = 1;
          }
          if (removedCount > 0) {
            const newValue = value.substring(0, lineStart) + value.substring(lineStart + removedCount);
            setBody(newValue);
            setTimeout(() => {
              const newPos = Math.max(lineStart, start - removedCount);
              textarea.selectionStart = textarea.selectionEnd = newPos;
            }, 0);
          }
        }
      } else {
        // 複数行選択時のインデント / アウトデント一括適用
        const selectedLinesText = value.substring(lineStart, actualLineEnd);
        const lines = selectedLinesText.split('\n');

        if (!e.shiftKey) {
          // Tab: 選択範囲の全行頭にインデント追加
          const newLines = lines.map((line) => indent + line);
          const replacement = newLines.join('\n');
          const newValue = value.substring(0, lineStart) + replacement + value.substring(actualLineEnd);
          setBody(newValue);
          setTimeout(() => {
            textarea.selectionStart = start + indent.length;
            textarea.selectionEnd = end + indent.length * lines.length;
          }, 0);
        } else {
          // Shift + Tab: 選択範囲の全行頭から最大2文字削除
          let totalRemoved = 0;
          let firstLineRemoved = 0;
          const newLines = lines.map((line, idx) => {
            let removed = 0;
            if (line.startsWith('  ')) {
              removed = 2;
            } else if (line.startsWith(' ') || line.startsWith('\t')) {
              removed = 1;
            }
            if (idx === 0) firstLineRemoved = removed;
            totalRemoved += removed;
            return line.substring(removed);
          });
          const replacement = newLines.join('\n');
          const newValue = value.substring(0, lineStart) + replacement + value.substring(actualLineEnd);
          setBody(newValue);
          setTimeout(() => {
            textarea.selectionStart = Math.max(lineStart, start - firstLineRemoved);
            textarea.selectionEnd = Math.max(lineStart, end - totalRemoved);
          }, 0);
        }
      }
      return;
    }

    // 3. Enter キー押下時の Markdown 記法自動継続（Auto-continuation）
    if (e.key === 'Enter') {
      const start = textarea.selectionStart;
      const value = textarea.value;

      // カーソルがある現在行を取得
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEndIndex = value.indexOf('\n', start);
      const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
      const currentLine = value.substring(lineStart, lineEnd);

      // Markdown記法のパターンマッチ
      // A. チェックボックス (To-Do): - [ ] または - [x]
      const todoMatch = currentLine.match(/^(\s*[-*+]\s+\[(?: |x|X)\]\s+)(.*)$/);
      // B. 箇条書きリスト: - , * , +
      const bulletMatch = currentLine.match(/^(\s*[-*+]\s+)(.*)$/);
      // C. 番号付きリスト: 1. , 2. 等
      const numberMatch = currentLine.match(/^(\s*)(\d+)(\.\s+)(.*)$/);
      // D. 引用: >
      const quoteMatch = currentLine.match(/^(\s*>+\s*)(.*)$/);

      if (todoMatch) {
        e.preventDefault();
        const prefix = todoMatch[1];
        const contentText = todoMatch[2].trim();

        // 内容が空（プレフィックスのみ）でEnterを押した場合は、リストを終了して通常の空行に
        if (!contentText) {
          const newValue = value.substring(0, lineStart) + value.substring(lineEnd);
          setBody(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        // 次の行は常に未完了 [ ] で継続
        const indentPart = prefix.match(/^(\s*)/)?.[1] || '';
        const bulletChar = prefix.match(/[-*+]/)?.[0] || '-';
        const nextPrefix = `${indentPart}${bulletChar} [ ] `;
        const insertText = '\n' + nextPrefix;

        const newValue = value.substring(0, start) + insertText + value.substring(start);
        setBody(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }, 0);
        return;
      }

      if (bulletMatch) {
        e.preventDefault();
        const prefix = bulletMatch[1];
        const contentText = bulletMatch[2].trim();

        // 空行でのEnterならプレフィックスを消去してリスト終了
        if (!contentText) {
          const newValue = value.substring(0, lineStart) + value.substring(lineEnd);
          setBody(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        const insertText = '\n' + prefix;
        const newValue = value.substring(0, start) + insertText + value.substring(start);
        setBody(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }, 0);
        return;
      }

      if (numberMatch) {
        e.preventDefault();
        const indentPart = numberMatch[1];
        const num = parseInt(numberMatch[2], 10);
        const delimiter = numberMatch[3];
        const contentText = numberMatch[4].trim();

        // 空行でのEnterならプレフィックスを消去してリスト終了
        if (!contentText) {
          const newValue = value.substring(0, lineStart) + value.substring(lineEnd);
          setBody(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        // 次の番号をインクリメント
        const nextPrefix = `${indentPart}${num + 1}${delimiter}`;
        const insertText = '\n' + nextPrefix;
        const newValue = value.substring(0, start) + insertText + value.substring(start);
        setBody(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }, 0);
        return;
      }

      if (quoteMatch) {
        e.preventDefault();
        const prefix = quoteMatch[1];
        const contentText = quoteMatch[2].trim();

        // 空行でのEnterならプレフィックスを消去して引用終了
        if (!contentText) {
          const newValue = value.substring(0, lineStart) + value.substring(lineEnd);
          setBody(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        const insertText = '\n' + prefix;
        const newValue = value.substring(0, start) + insertText + value.substring(start);
        setBody(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        }, 0);
        return;
      }
    }
  };

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

  // タグピッカー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setShowTagPicker(false);
      }
    };
    if (showTagPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagPicker]);

  // タグ検索フィルタリング（ナンバリング "01" や文字 "Obsidian" に対応）
  const filteredTags = availableTags.filter((tag) => {
    const query = tagSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return tag.name.toLowerCase().includes(query);
  });

  const toggleTag = (tag: Tag) => {
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
        zIndex: showTagPicker ? 40 : 10, // タグ選択展開時はタイムラインよりも前面に強制配置
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
          {/* タグ選択ボタン & ポップオーバー */}
          <div style={{ position: 'relative' }} ref={tagPickerRef}>
            <button
              type="button"
              onClick={() => setShowTagPicker(!showTagPicker)}
              style={{
                background: showTagPicker ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                border: `1px solid ${showTagPicker ? 'var(--accent-border)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                color: showTagPicker ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Hash size={14} /> タグ選択
              {selectedTags.length > 0 && (
                <span
                  style={{
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-full)',
                    padding: '1px 6px',
                    fontSize: '0.7rem',
                    marginLeft: '2px',
                  }}
                >
                  {selectedTags.length}
                </span>
              )}
            </button>

            {/* タグインクリメンタル検索ポップオーバー (最前面に完全固定) */}
            {showTagPicker && (
              <div
                className="popover-solid"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '320px',
                  maxWidth: 'calc(100vw - 40px)',
                  maxHeight: '340px',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  zIndex: 100, // スタッキングコンテキスト最上位
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* 検索入力欄（先頭番号やキーワードでヒット） */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="番号(01)やキーワードで検索..."
                    autoFocus
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      width: '100%',
                    }}
                  />
                  {tagSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTagSearchQuery('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* タグ候補リスト */}
                <div
                  style={{
                    overflowY: 'auto',
                    maxHeight: '240px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {filteredTags.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 8px' }}>
                      該当するタグがありません
                    </div>
                  ) : (
                    filteredTags.map((tag) => {
                      const isSelected = selectedTags.some((t) => t.id === tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: isSelected ? 'var(--accent-light)' : 'transparent',
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                            fontSize: '0.85rem',
                            fontWeight: isSelected ? 600 : 400,
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tag.name}
                          </span>
                          {isSelected && (
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginLeft: '6px' }}>
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ピン留めトグルボタン */}
          <button
            type="button"
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
            {isPinned ? 'ピン固定中' : 'ピン留め'}
          </button>

          {/* 日報紐付けトグルボタン (デフォルト適用) */}
          <button
            type="button"
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
            {linkDailyReport ? '日報: ON' : '日報: OFF'}
          </button>
        </div>

        {/* 送信ボタン */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!content.trim() || isSubmitting}
          style={{
            background: content.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: content.trim() ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '8px 18px',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: content.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            boxShadow: content.trim() ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
          }}
        >
          <Send size={14} /> 投稿
        </button>
      </div>
    </div>
  );
}
