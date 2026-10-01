import { useState, useRef, useEffect } from 'react';
import { Hash, Search, X } from 'lucide-react';
import type { Tag } from '../types';

interface TagPickerProps {
  availableTags: Tag[];
  selectedTags: Tag[];
  onToggleTag: (tag: Tag) => void;
  isRequired?: boolean;
  limit?: number | null;
}

/**
 * タグ選択ボタンおよびインクリメンタル検索ポップオーバー
 */
export function TagPicker({
  availableTags,
  selectedTags,
  onToggleTag,
  isRequired = false,
  limit,
}: TagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // 外側クリックでポップオーバーを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // タグ検索フィルタリング（ナンバリング "01" や文字 "Obsidian" に対応）
  const filteredTags = availableTags.filter((tag) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return tag.name.toLowerCase().includes(query);
  });

  return (
    <div style={{ position: 'relative' }} ref={pickerRef}>
      <button
        type="button"
        className="mobile-icon-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={isRequired && selectedTags.length === 0 ? 'タグ選択（必須）' : 'タグ選択'}
        style={{
          background: isOpen ? 'var(--accent-light)' : 'var(--bg-tertiary)',
          border: `1px solid ${isOpen ? 'var(--accent-border)' : 'var(--border-color)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '6px 12px',
          color: isOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.8rem',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Hash size={14} />
        <span className="hide-on-mobile">タグ選択</span>
        <span className="show-on-mobile" style={{ display: 'none' }}>タグ</span>
        {isRequired && selectedTags.length === 0 && (
          <span
            style={{
              color: 'var(--danger)',
              fontWeight: 700,
              fontSize: '0.9rem',
              lineHeight: 1,
              marginLeft: '-1px',
            }}
            title="タグの選択が必須です"
          >
            *
          </span>
        )}
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
      {isOpen && (
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
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
                    className={`tag-dropdown-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onToggleTag(tag)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--accent-light)' : undefined,
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 400,
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

          {/* 1件制限時のフッター表示 */}
          {limit === 1 && (
            <div
              style={{
                fontSize: '0.73rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                paddingTop: '6px',
                borderTop: '1px solid var(--border-color)',
                userSelect: 'none',
              }}
            >
              1件のみ選択可
            </div>
          )}
        </div>
      )}
    </div>
  );
}
