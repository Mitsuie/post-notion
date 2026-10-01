import { Pin, Calendar, Hash } from 'lucide-react';
import { ToggleSwitch } from '../ToggleSwitch';
import type { UserPreferences } from '../../hooks/useUserPreferences';

interface PreferencesSectionProps {
  preferences: UserPreferences;
  theme: 'light' | 'dark';
  canAccessDailyReport: boolean;
  canAccessTags: boolean;
  onSetDefaultPinned: (val: boolean) => void;
  onSetDefaultDailyReport: (val: boolean) => void;
  onSetRequireTag: (val: boolean) => void;
}

export function PreferencesSection({
  preferences,
  theme,
  canAccessDailyReport,
  canAccessTags,
  onSetDefaultPinned,
  onSetDefaultDailyReport,
  onSetRequireTag,
}: PreferencesSectionProps) {
  return (
    <section>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '10px',
        }}
      >
        投稿デフォルト設定 (Post Preferences)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* ピン留めデフォルト設定 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              <Pin size={14} style={{ color: 'var(--pinned-color)' }} />
              <span>ピン留めのデフォルト</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              新規作成時の初期ピン留め状態
            </div>
          </div>
          <ToggleSwitch
            checked={preferences.defaultPinned}
            activeColor="#f59e0b"
            onChange={onSetDefaultPinned}
            ariaLabel="ピン留めのデフォルト設定"
            title={preferences.defaultPinned ? '現在: ON (クリックでOFF)' : '現在: OFF (クリックでON)'}
            theme={theme}
          />
        </div>

        {/* 日報連携デフォルト設定 (日報DBアクセス可能時のみ表示) */}
        {canAccessDailyReport && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>日報連携のデフォルト</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                当日の日報ページへの自動連携
              </div>
            </div>
            <ToggleSwitch
              checked={preferences.defaultDailyReport}
              activeColor="var(--accent-primary)"
              onChange={onSetDefaultDailyReport}
              ariaLabel="日報連携のデフォルト設定"
              title={
                preferences.defaultDailyReport
                  ? '現在: ON (クリックでOFF)'
                  : '現在: OFF (クリックでON)'
              }
              theme={theme}
            />
          </div>
        )}

        {/* タグ選択の必須化設定 (タグDBアクセス可能時のみ表示) */}
        {canAccessTags && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <Hash size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>タグ選択の必須化</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                投稿時に1つ以上のタグ選択を必須にする
              </div>
            </div>
            <ToggleSwitch
              checked={preferences.requireTag}
              activeColor="var(--accent-primary)"
              onChange={onSetRequireTag}
              ariaLabel="タグ選択の必須化設定"
              title={
                preferences.requireTag
                  ? '現在: 必須 (クリックで任意に変更)'
                  : '現在: 任意 (クリックで必須に変更)'
              }
              theme={theme}
            />
          </div>
        )}
      </div>
    </section>
  );
}
