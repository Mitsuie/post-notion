import { useEffect } from 'react';
import { X, Sliders } from 'lucide-react';
import { useSystemStatus } from '../hooks/useSystemStatus';
import type { UserPreferences } from '../hooks/useUserPreferences';
import { ThemeSection } from './settings/ThemeSection';
import { PreferencesSection } from './settings/PreferencesSection';
import { ConnectionStatusSection } from './settings/ConnectionStatusSection';
import { SyncSection } from './settings/SyncSection';
import { ShortcutsHelpSection } from './settings/ShortcutsHelpSection';

export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefreshAll: () => Promise<void>;
  isRefreshingAll: boolean;
  preferences: UserPreferences;
  onSetDefaultPinned: (val: boolean) => void;
  onSetDefaultDailyReport: (val: boolean) => void;
  onSetRequireTag: (val: boolean) => void;
  isDailyReportConfigured?: boolean;
  isTagsConfigured?: boolean;
  isDailyReportAccessible?: boolean;
  isTagsAccessible?: boolean;
}

export function SettingsDrawer({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  onRefreshAll,
  isRefreshingAll,
  preferences,
  onSetDefaultPinned,
  onSetDefaultDailyReport,
  onSetRequireTag,
  isDailyReportConfigured = false,
  isTagsConfigured = false,
  isDailyReportAccessible,
  isTagsAccessible,
}: SettingsDrawerProps) {
  // ESCキーでドロワーを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ドロワー展開時は背景スクロールを抑止
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Notion接続状況の診断データ取得
  const {
    statusData,
    isLoading: isStatusLoading,
    isRefetching: isStatusRefetching,
    refetch: refetchStatus,
    isDailyReportAccessible: isSystemDailyReportAccessible,
    isTagsAccessible: isSystemTagsAccessible,
  } = useSystemStatus({ enabled: isOpen });

  if (!isOpen) return null;

  // タグDB / 日報DB がアクセス可能（シークレット設定済み かつ 接続疎通OK）か判定
  const canAccessDailyReport =
    isDailyReportAccessible ?? (isDailyReportConfigured && isSystemDailyReportAccessible);
  const canAccessTags =
    isTagsAccessible ?? (isTagsConfigured && isSystemTagsAccessible);

  const isWorking = isStatusLoading || isStatusRefetching;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {/* 半透明暗転バックドロップ（タップで閉じる） */}
      <div
        onClick={onClose}
        className="animate-fade-in"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      />

      {/* ドロワーパネル本体（右からスライドイン） */}
      <div
        className="animate-slide-in-right glass"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '380px',
          background: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-popover)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1001,
        }}
      >
        {/* ドロワーヘッダー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
            paddingBottom: '16px',
            paddingLeft: '20px',
            paddingRight: 'max(env(safe-area-inset-right, 0px), 20px)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              設定 & ステータス
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
            title="閉じる (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* ドロワーコンテンツ（スクロール可能エリア） */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 28px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* セクション1: 外観（テーマ設定） */}
          <ThemeSection theme={theme} onToggleTheme={onToggleTheme} />

          {/* セクション2: 投稿デフォルト設定 */}
          <PreferencesSection
            preferences={preferences}
            theme={theme}
            canAccessDailyReport={Boolean(canAccessDailyReport)}
            canAccessTags={Boolean(canAccessTags)}
            onSetDefaultPinned={onSetDefaultPinned}
            onSetDefaultDailyReport={onSetDefaultDailyReport}
            onSetRequireTag={onSetRequireTag}
          />

          {/* セクション3: Notion 接続状況 */}
          <ConnectionStatusSection
            statusData={statusData}
            isLoading={isStatusLoading}
            isWorking={isWorking}
            onRefetch={() => refetchStatus()}
          />

          {/* セクション4: データ同期アクション */}
          <SyncSection onRefreshAll={onRefreshAll} isRefreshingAll={isRefreshingAll} />

          {/* セクション5: アプリ情報 & 操作ヒント */}
          <ShortcutsHelpSection version="v1.0.2" />
        </div>
      </div>
    </div>
  );
}
