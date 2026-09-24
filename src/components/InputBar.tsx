import React, { useState, useRef, useEffect } from 'react';
import { Send, Pin, Hash, X, Search } from 'lucide-react';
import type { Tag, CreatePostInput } from '../types';
import { extractAndResolveTags } from '../utils/tagParser';

interface InputBarProps {
  availableTags: Tag[];
  onSubmit: (input: CreatePostInput) => void;
  isSubmitting?: boolean;
}

export function InputBar({ availableTags, onSubmit, isSubmitting }: InputBarProps) {
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  // 本文変更時に自動で #ハッシュタグ を検出して選択リストにマージ
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);

    // 本文中のハッシュタグを自動解決
    const detectedTags = extractAndResolveTags(newText, availableTags);
    if (detectedTags.length > 0) {
      setSelectedTags((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const toAdd = detectedTags.filter((t) => !existingIds.has(t.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  };

  // 送信処理（摩擦ゼロ: 即時クリア & フォーカス維持）
  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    onSubmit({
      title: trimmed,
      tagIds: selectedTags.map((t) => t.id),
      pinned: isPinned,
    });

    // 0秒クリア & フォーカス維持
    setContent('');
    setSelectedTags([]);
    setIsPinned(false);
    setShowTagPicker(false);
    setTagSearchQuery('');

    // フォーカス維持
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 10);
  };

  // キーボードショートカット (Cmd/Ctrl + Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
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
      {/* 選択されたタグのバッジ */}
      {selectedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
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

      {/* テキスト入力エリア */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        placeholder="いま考えていること、覚え書き、思考の断片... (Cmd/Ctrl + Enter で即送信)"
        rows={3}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary)',
          fontSize: '0.975rem',
          lineHeight: 1.6,
          resize: 'none',
          fontFamily: 'inherit',
        }}
      />

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
          >
            <Pin size={14} style={{ fill: isPinned ? 'currentColor' : 'none' }} />
            {isPinned ? 'ピン固定中' : 'ピン留め'}
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
