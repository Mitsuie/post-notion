import { RefreshCw, Database, Calendar, ShieldCheck } from 'lucide-react';
import { DbStatusCard } from '../DbStatusCard';
import type { StatusData } from '../../types';

interface ConnectionStatusSectionProps {
  statusData?: StatusData;
  isLoading: boolean;
  isWorking: boolean;
  onRefetch: () => void;
}

export function ConnectionStatusSection({
  statusData,
  isLoading,
  isWorking,
  onRefetch,
}: ConnectionStatusSectionProps) {
  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Notion 接続状況
        </div>
        <button
          type="button"
          onClick={onRefetch}
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

      {isLoading ? (
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

          {/* Tags データベース (シークレット設定時のみ表示) */}
          {statusData.tagsDb?.configured && (
            <DbStatusCard
              title={statusData.tagsDb?.title || 'タグDB'}
              icon={<Database size={13} style={{ color: '#10b981' }} />}
              connected={statusData.tagsDb?.connected}
              configured={statusData.tagsDb?.configured ?? false}
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
          )}

          {/* 日報データベース (DB_日報) (シークレット設定時のみ表示) */}
          {statusData.dailyReportDb?.configured && (
            <DbStatusCard
              title={statusData.dailyReportDb?.title || '日報DB'}
              icon={<Calendar size={13} style={{ color: 'var(--accent-primary)' }} />}
              connected={statusData.dailyReportDb?.connected}
              configured={statusData.dailyReportDb?.configured ?? false}
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
          )}

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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text-secondary)',
              }}
            >
              <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
              <span>API認証キー</span>
            </div>
            <span
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
                fontSize: '0.7rem',
              }}
            >
              {statusData.environment?.notionApiKeyMasked || '設定済み'}
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          ステータス情報が取得できませんでした
        </div>
      )}
    </section>
  );
}
