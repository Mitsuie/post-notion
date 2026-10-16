import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

export interface PostActionsMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

/**
 * 投稿カードの「…」メニュー
 * - 外側クリック・Esc で閉じる（Esc の場合はトリガーボタンへフォーカスを戻す。TagPicker と同じ挙動）
 */
export function PostActionsMenu({ items }: { items: PostActionsMenuItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        className="card-action-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="その他の操作"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="その他の操作"
      >
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="glass"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 'calc(100% + 4px)',
            zIndex: 20,
            minWidth: '160px',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card-solid)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          {items.map(({ label, icon: Icon, onSelect, danger }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              autoFocus={label === items[0].label}
              onClick={() => {
                setIsOpen(false);
                onSelect();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: danger ? 'var(--danger)' : 'var(--text-primary)',
                fontSize: '0.8rem',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
