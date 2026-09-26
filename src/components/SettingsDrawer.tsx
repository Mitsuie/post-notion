import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Sun,
  Moon,
  Database,
  RefreshCw,
  Sliders,
  Command,
  Info,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { DbStatusCard } from './DbStatusCard';
import { apiFetch } from '../utils/apiClient';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefreshAll: () => Promise<void>;
  isRefreshingAll: boolean;
}

interface StatusData {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  environment?: {
    configured: boolean;
    notionApiKeyMasked?: string;
    missing?: string[];
  };
  postsDb?: {
    connected: boolean;
    title?: string;
    idMasked?: string;
    properties?: string[];
    error?: string;
  };
  tagsDb?: {
    connected: boolean;
    configured?: boolean;
    title?: string;
    idMasked?: string;
    tagsCount?: number;
    error?: string;
  };
  dailyReportDb?: {
    connected: boolean;
    configured?: boolean;
    title?: string;
    idMasked?: string;
    properties?: string[];
    error?: string;
  };
}

export function SettingsDrawer({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  onRefreshAll,
  isRefreshingAll,
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
    data: statusData,
    isLoading: isStatusLoading,
    isRefetching: isStatusRefetching,
    refetch: refetchStatus,
  } = useQuery<StatusData>({
    queryKey: ['system-status'],
    queryFn: async () => {
      return apiFetch<StatusData>('/api/status');
    },
    enabled: isOpen, // ドロワー展開時のみクエリ実行
    staleTime: 30 * 1000,
  });

  if (!isOpen) return null;

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
          <section>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              外観 (Appearance)
            </div>
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-tertiary)',
                padding: '4px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => theme !== 'light' && onToggleTheme()}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: theme === 'light' ? 600 : 400,
                  background: theme === 'light' ? 'var(--bg-card)' : 'transparent',
                  color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Sun size={15} style={{ color: theme === 'light' ? '#f59e0b' : 'inherit' }} />
                <span>ライト</span>
              </button>

              <button
                type="button"
                onClick={() => theme !== 'dark' && onToggleTheme()}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: theme === 'dark' ? 600 : 400,
                  background: theme === 'dark' ? 'var(--bg-card)' : 'transparent',
                  color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Moon size={15} style={{ color: theme === 'dark' ? '#60a5fa' : 'inherit' }} />
                <span>ダーク</span>
              </button>
            </div>
          </section>

          {/* セクション2: Notion 接続状況 */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Notion 接続状況
              </div>
              <button
                type="button"
                onClick={() => refetchStatus()}
                disabled={isWorking}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.75rem',
                  cursor: isWorking ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                  opacity: isWorking ? 0.6 : 1,
                }}
                title="接続状態を再チェック"
              >
                <RefreshCw size={11} className={isWorking ? 'animate-spin' : ''} />
                <span>再検証</span>
              </button>
            </div>

            {isStatusLoading ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <RefreshCw size={14} className="animate-spin" />
                <span>Notion接続を確認中...</span>
              </div>
            ) : statusData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Posts データベース */}
                <DbStatusCard
                  title={statusData.postsDb?.title || 'ポストDB'}
                  icon={<Database size={13} style={{ color: 'var(--accent-primary)' }} />}
                  connected={statusData.postsDb?.connected}
                  idMasked={statusData.postsDb?.idMasked}
                  properties={statusData.postsDb?.properties}
                  error={statusData.postsDb?.error}
                />

                {/* Tags データベース */}
                <DbStatusCard
                  title={statusData.tagsDb?.title || 'タグDB'}
                  icon={<Database size={13} style={{ color: '#10b981' }} />}
                  connected={statusData.tagsDb?.connected}
                  configured={statusData.tagsDb?.configured}
                  idMasked={statusData.tagsDb?.idMasked}
                  extraInfo={
                    statusData.tagsDb?.connected && typeof statusData.tagsDb?.tagsCount === 'number' ? (
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {statusData.tagsDb.tagsCount}件のタグ登録
                      </span>
                    ) : undefined
                  }
                  error={statusData.tagsDb?.error}
                />

                {/* 日報データベース (DB_日報) */}
                <DbStatusCard
                  title={statusData.dailyReportDb?.title || '日報DB'}
                  icon={<Calendar size={13} style={{ color: 'var(--accent-primary)' }} />}
                  connected={statusData.dailyReportDb?.connected}
                  configured={statusData.dailyReportDb?.configured}
                  idMasked={statusData.dailyReportDb?.idMasked}
                  extraInfo={
                    statusData.dailyReportDb?.connected ? (
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                        連携中
                      </span>
                    ) : undefined
                  }
                  error={statusData.dailyReportDb?.error}
                />


                {/* API認証ステータス */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
                    <span>API認証キー</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {statusData.environment?.notionApiKeyMasked || '設定済み'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ステータス情報が取得できませんでした
              </div>
            )}
          </section>

          {/* セクション3: データ同期アクション */}
          <section>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              データ同期 (Sync)
            </div>
            <button
              type="button"
              onClick={onRefreshAll}
              disabled={isRefreshingAll}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: isRefreshingAll ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              <RefreshCw size={13} className={isRefreshingAll ? 'animate-spin' : ''} />
              <span>{isRefreshingAll ? 'Notionから再取得中...' : 'すべてのデータを再取得（キャッシュクリア）'}</span>
            </button>
          </section>

          {/* セクション4: アプリ情報 & 操作ヒント */}
          <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              <Command size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>キーボードショートカット</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>投稿の即時送信</span>
                <kbd style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.7rem' }}>
                  Cmd / Ctrl + Enter
                </kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Markdown改行自動継続</span>
                <kbd style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.7rem' }}>
                  Enter
                </kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>階層インデント / アウトデント</span>
                <kbd style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.7rem' }}>
                  Tab / Shift + Tab
                </kbd>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '16px' }}>
              <Info size={12} />
              <span>post-notion v0.1.0 • Cloudflare Pages + Notion API</span>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
