import { RefreshCw } from 'lucide-react';

interface SyncSectionProps {
  onRefreshAll: () => Promise<void>;
  isRefreshingAll: boolean;
}

export function SyncSection({ onRefreshAll, isRefreshingAll }: SyncSectionProps) {
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
        データ同期 (Sync)
      </div>
      <button
        type="button"
        className="btn-sync-action"
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
      >
        <RefreshCw size={13} className={isRefreshingAll ? 'animate-spin' : ''} />
        <span>{isRefreshingAll ? 'Notionから再取得中...' : 'すべてのデータを再取得（キャッシュクリア）'}</span>
      </button>
    </section>
  );
}
