import { Filter, Calendar, Tag as TagIcon, X, RotateCcw } from 'lucide-react';

interface ActiveFilterChipsProps {
  isFiltered: boolean;
  isDateFiltered: boolean;
  dateFilterLabel: string;
  selectedTagIds: string[];
  tagMap: Map<string, string>;
  onClearDateFilter: () => void;
  onToggleTag: (tagId: string) => void;
  onResetDefault: () => void;
  onClearAll: () => void;
  showResetDefault?: boolean;
}

export function ActiveFilterChips({
  isFiltered,
  isDateFiltered,
  dateFilterLabel,
  selectedTagIds,
  tagMap,
  onClearDateFilter,
  onToggleTag,
  onResetDefault,
  onClearAll,
  showResetDefault = false,
}: ActiveFilterChipsProps) {
  if (!isFiltered) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
        marginBottom: '12px',
        padding: '6px 10px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        fontSize: '0.75rem',
      }}
    >
      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '2px' }}>
        <Filter size={11} />
        適用中:
      </span>

      {/* 作成日チップ */}
      {isDateFiltered && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--accent-light)',
            color: 'var(--accent-primary)',
            fontWeight: 500,
            border: '1px solid rgba(var(--accent-primary-rgb, 59, 130, 246), 0.2)',
          }}
        >
          <Calendar size={11} />
          <span>作成日: {dateFilterLabel}</span>
          <button
            type="button"
            onClick={onClearDateFilter}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
            title="作成日フィルターを解除（全期間表示）"
          >
            <X size={11} />
          </button>
        </span>
      )}

      {/* 選択された各タグチップ */}
      {selectedTagIds.map((tagId) => {
        const tagName = tagMap.get(tagId) || 'タグ';
        return (
          <span
            key={tagId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-light)',
              color: 'var(--accent-primary)',
              fontWeight: 500,
              border: '1px solid rgba(var(--accent-primary-rgb, 59, 130, 246), 0.2)',
            }}
          >
            <TagIcon size={11} />
            <span>{tagName}</span>
            <button
              type="button"
              onClick={() => onToggleTag(tagId)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              title={`「${tagName}」の絞り込みを解除`}
            >
              <X size={11} />
            </button>
          </span>
        );
      })}

      {/* クイック操作ボタン */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {showResetDefault && (
          <button
            type="button"
            onClick={onResetDefault}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
            title="デフォルト（直近30日間・タグ全件）に戻す"
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <RotateCcw size={10} />
            <span>初期状態に戻す</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClearAll}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.75rem',
            textDecoration: 'underline',
          }}
          title="すべてのフィルターを解除して全投稿を表示"
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          すべて解除
        </button>
      </div>
    </div>
  );
}
