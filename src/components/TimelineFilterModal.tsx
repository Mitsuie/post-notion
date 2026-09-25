import type { Dispatch, SetStateAction } from 'react';
import { Filter, Calendar, Tag as TagIcon, X, Check, RotateCcw } from 'lucide-react';
import type { Tag } from '../types';
import { DatePreset, FilterState, DEFAULT_FILTER } from '../hooks/useTimelineFilter';

interface TimelineFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filter: FilterState;
  setFilter: Dispatch<SetStateAction<FilterState>>;
  availableTags: Tag[];
  isTagsConfigured?: boolean;
  onToggleTag: (tagId: string) => void;
}

export function TimelineFilterModal({
  isOpen,
  onClose,
  filter,
  setFilter,
  availableTags,
  isTagsConfigured = true,
  onToggleTag,
}: TimelineFilterModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="glass"
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        marginBottom: '12px',
        border: '1px solid var(--border-hover)',
        boxShadow: 'var(--shadow-md)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      {/* パネル上部ヘッダー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Filter size={14} style={{ color: 'var(--accent-primary)' }} />
          <span>フィルター設定</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="フィルター設定パネルを閉じる"
        >
          <X size={15} />
        </button>
      </div>

      {/* セクション1: 作成日フィルター */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Calendar size={12} />
          <span>作成日 (Created Time)</span>
        </div>

        {/* 期間プリセットピルボタン群 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: filter.datePreset === 'custom' ? '10px' : 0 }}>
          {[
            { id: 'all' as DatePreset, label: 'すべて（全期間）' },
            { id: 'today' as DatePreset, label: '今日' },
            { id: '7d' as DatePreset, label: '直近7日' },
            { id: '30d' as DatePreset, label: '直近30日 (デフォルト)' },
            { id: 'custom' as DatePreset, label: '日付指定...' },
          ].map((preset) => {
            const isActive = filter.datePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setFilter((prev) => ({ ...prev, datePreset: preset.id }))}
                style={{
                  background: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* カレンダー日付範囲指定ピッカー（「日付指定」選択時のみインライン表示） */}
        {filter.datePreset === 'custom' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-tertiary)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>開始:</span>
              <input
                type="date"
                value={filter.customStartDate}
                onChange={(e) => setFilter((prev) => ({ ...prev, customStartDate: e.target.value }))}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '3px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              />
            </div>
            <span style={{ color: 'var(--text-muted)' }}>〜</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>終了:</span>
              <input
                type="date"
                value={filter.customEndDate}
                onChange={(e) => setFilter((prev) => ({ ...prev, customEndDate: e.target.value }))}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '3px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              />
            </div>
            {(filter.customStartDate || filter.customEndDate) && (
              <button
                type="button"
                onClick={() => setFilter((prev) => ({ ...prev, customStartDate: '', customEndDate: '' }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  marginLeft: 'auto',
                }}
              >
                クリア
              </button>
            )}
          </div>
        )}
      </div>

      {/* セクション2: タグフィルター（複数選択可 - タグDB設定時かつタグ存在時のみ表示） */}
      {isTagsConfigured && availableTags.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TagIcon size={12} />
              <span>タグ (複数選択可・いずれかを含む)</span>
            </div>
            {filter.selectedTagIds.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter((prev) => ({ ...prev, selectedTagIds: [] }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  padding: 0,
                }}
              >
                タグ全解除 ({filter.selectedTagIds.length}件選択中)
              </button>
            )}
          </div>

          {/* タグ一覧（縦並びチェックリスト形式） */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '220px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {availableTags.map((tag) => {
              const isSelected = filter.selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggleTag(tag.id)}
                  style={{
                    width: '100%',
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  {/* チェックボックス風アイコン */}
                  <span
                    style={{
                      width: '15px',
                      height: '15px',
                      borderRadius: '3px',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      background: isSelected ? 'var(--accent-primary)' : 'var(--bg-card)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tag.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* パネル下部フッターアクション */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFilter(DEFAULT_FILTER)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <RotateCcw size={11} />
            <span>デフォルト（直近30日）に戻す</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter({
                datePreset: 'all',
                customStartDate: '',
                customEndDate: '',
                selectedTagIds: [],
              })
            }
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            全条件をクリア
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'var(--accent-primary)',
            border: 'none',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 12px',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          完了
        </button>
      </div>
    </div>
  );
}
