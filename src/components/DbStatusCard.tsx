import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface DbStatusCardProps {
  title: string;
  icon: ReactNode;
  connected?: boolean;
  configured?: boolean;
  idMasked?: string;
  extraInfo?: React.ReactNode;
  properties?: string[];
  error?: string;
}

/**
 * データベース接続状態の診断カード
 */
export function DbStatusCard({
  title,
  icon,
  connected,
  configured = true,
  idMasked,
  extraInfo,
  properties,
  error,
}: DbStatusCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        border: '1px solid var(--border-color)',
        fontSize: '0.8rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {icon}
          <span>{title}</span>
        </div>
        {connected ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--success)', fontSize: '0.72rem', fontWeight: 500 }}>
            <CheckCircle2 size={11} />
            正常
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              color: configured === false ? 'var(--text-muted)' : 'var(--danger)',
              fontSize: '0.72rem',
              fontWeight: 500,
            }}
          >
            <AlertCircle size={11} />
            {configured === false ? '未設定 (任意)' : 'エラー'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
        <span>ID: {idMasked || '未設定'}</span>
        {connected && extraInfo}
      </div>

      {properties && properties.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {properties.map((prop) => (
            <span
              key={prop}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '1px 6px',
                fontSize: '0.68rem',
                color: 'var(--text-secondary)',
              }}
            >
              {prop}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '4px' }}>
          {error}
        </p>
      )}
    </div>
  );
}
