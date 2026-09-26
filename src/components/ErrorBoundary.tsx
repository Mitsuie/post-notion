import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { clearCacheAndReload, reloadPage } from '../utils/pwa';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    reloadPage();
  };

  private handleClearAndReload = () => {
    clearCacheAndReload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'var(--bg-primary, #0a0f1d)',
            color: 'var(--text-primary, #f8fafc)',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="glass"
            style={{
              maxWidth: '440px',
              width: '100%',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: '32px 24px',
              border: '1px solid var(--border-hover, #1e293b)',
              boxShadow: 'var(--shadow-popover, 0 10px 25px rgba(0,0,0,0.3))',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AlertOctagon size={32} />
            </div>

            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
              問題が発生しました
            </h2>
            <p
              style={{
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: 'var(--text-muted, #94a3b8)',
                marginBottom: '24px',
              }}
            >
              認証セッションが切れたか、予期せぬ通信エラーが発生しました。<br />
              画面を再読み込みして再接続してください。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md, 8px)',
                  backgroundColor: 'var(--accent-primary, #38bdf8)',
                  color: 'var(--accent-text, #0a0f1d)',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
                <span>再読み込みする</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearAndReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md, 8px)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted, #94a3b8)',
                  border: '1px solid var(--border-color, #1e293b)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                <span>キャッシュを初期化して再試行</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
