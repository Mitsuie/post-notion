import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Filter, Calendar, Tag as TagIcon, X, Check, RotateCcw, Search } from 'lucide-react';
import type { Tag } from '../types';
import {
  DatePreset,
  FilterState,
  DEFAULT_FILTER,
  CLEARED_FILTER,
  MAX_KEYWORD_LENGTH,
} from '../hooks/useTimelineFilter';

// 入力が止まってから絞り込みに反映するまでの待ち時間（キー入力ごとの Notion 呼び出しを防ぐ）
const KEYWORD_DEBOUNCE_MS = 300;

/**
 * タイトルのキーワード入力欄（入力は 300ms デバウンスしてから filter.keyword に反映する）
 */
function KeywordInput({ keyword, onChange }: { keyword: string; onChange: (keyword: string) => void }) {
  const [value, setValue] = useState(keyword);

  // チップからの解除など、外部で変更されたキーワードを入力欄に反映
  useEffect(() => {
    setValue(keyword);
  }, [keyword]);

  useEffect(() => {
    if (value === keyword) return;
    const timer = setTimeout(() => onChange(value), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, keyword, onChange]);

  return (
    <div className="timeline-filter__keyword">
      <Search size={13} className="timeline-filter__keyword-icon" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="タイトルに含む文字で検索..."
        aria-label="タイトルのキーワード"
        maxLength={MAX_KEYWORD_LENGTH}
        className="input-comment timeline-filter__keyword-input"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            onChange('');
          }}
          aria-label="キーワードをクリア"
          className="timeline-filter__keyword-clear"
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

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
    <div className="glass timeline-filter">
      {/* パネル上部ヘッダー */}
      <div className="timeline-filter__header">
        <div className="timeline-filter__title">
          <Filter size={14} className="timeline-filter__title-icon" />
          <span>フィルター設定</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="timeline-filter__close"
          title="フィルター設定パネルを閉じる"
          aria-label="閉じる"
        >
          <X size={15} />
        </button>
      </div>

      {/* セクション0: キーワード（タイトル）検索 */}
      <div className="timeline-filter__section">
        <div className="timeline-filter__label">
          <Search size={12} />
          <span>キーワード (タイトル)</span>
        </div>
        <KeywordInput
          keyword={filter.keyword}
          onChange={(keyword) => setFilter((prev) => ({ ...prev, keyword }))}
        />
      </div>

      {/* セクション1: 作成日フィルター */}
      <div className="timeline-filter__section">
        <div className="timeline-filter__label">
          <Calendar size={12} />
          <span>作成日 (Created Time)</span>
        </div>

        {/* 期間プリセットピルボタン群 */}
        <div
          className={`timeline-filter__presets ${filter.datePreset === 'custom' ? 'timeline-filter__presets--with-custom' : ''}`}
        >
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
                aria-pressed={isActive}
                className="timeline-filter__preset"
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* カレンダー日付範囲指定ピッカー（「日付指定」選択時のみインライン表示） */}
        {filter.datePreset === 'custom' && (
          <div className="timeline-filter__custom-date">
            <div className="timeline-filter__date-field">
              <span className="timeline-filter__date-label">開始:</span>
              <input
                type="date"
                value={filter.customStartDate}
                onChange={(e) => setFilter((prev) => ({ ...prev, customStartDate: e.target.value }))}
                aria-label="開始日"
                className="input-date timeline-filter__date-input"
              />
            </div>
            <span className="timeline-filter__date-label">〜</span>
            <div className="timeline-filter__date-field">
              <span className="timeline-filter__date-label">終了:</span>
              <input
                type="date"
                value={filter.customEndDate}
                onChange={(e) => setFilter((prev) => ({ ...prev, customEndDate: e.target.value }))}
                aria-label="終了日"
                className="input-date timeline-filter__date-input"
              />
            </div>
            {(filter.customStartDate || filter.customEndDate) && (
              <button
                type="button"
                onClick={() => setFilter((prev) => ({ ...prev, customStartDate: '', customEndDate: '' }))}
                className="timeline-filter__date-clear"
              >
                クリア
              </button>
            )}
          </div>
        )}
      </div>

      {/* セクション2: タグフィルター（複数選択可 - タグDB設定時かつタグ存在時のみ表示） */}
      {isTagsConfigured && availableTags.length > 0 && (
        <div className="timeline-filter__section">
          <div className="timeline-filter__label-row">
            <div className="timeline-filter__label-text">
              <TagIcon size={12} />
              <span>タグ (複数選択可・いずれかを含む)</span>
            </div>
            {filter.selectedTagIds.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter((prev) => ({ ...prev, selectedTagIds: [] }))}
                className="timeline-filter__tag-clear"
              >
                タグ全解除 ({filter.selectedTagIds.length}件選択中)
              </button>
            )}
          </div>

          {/* タグ一覧（縦並びチェックリスト形式） */}
          <div className="timeline-filter__tag-list">
            {availableTags.map((tag) => {
              const isSelected = filter.selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`filter-tag-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onToggleTag(tag.id)}
                  aria-pressed={isSelected}
                  // 選択状態による色はインラインに残す（クラスへ移すと .filter-tag-item:hover が効き、見た目が変わるため）
                  style={{
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {/* チェックボックス風アイコン */}
                  <span className="timeline-filter__tag-check">
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="timeline-filter__tag-name">
                    {tag.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* パネル下部フッターアクション */}
      <div className="timeline-filter__footer">
        <div className="timeline-filter__footer-actions">
          <button
            type="button"
            className="text-btn-muted"
            onClick={() => setFilter(DEFAULT_FILTER)}
            title="デフォルト（直近30日）に戻す"
          >
            <RotateCcw size={11} />
            <span>デフォルト（直近30日）に戻す</span>
          </button>

          <button
            type="button"
            className="text-btn-muted"
            onClick={() =>
              setFilter(CLEARED_FILTER)
            }
          >
            全条件をクリア
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="timeline-filter__done"
        >
          完了
        </button>
      </div>
    </div>
  );
}
