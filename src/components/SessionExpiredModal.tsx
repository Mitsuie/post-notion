import { AlertTriangle, LogIn, RefreshCw, Save } from 'lucide-react';

interface SessionExpiredModalProps {
  isOpen: boolean;
  hasDraft?: boolean;
  onReLogin: () => void;
  onClearCacheAndReload: () => void;
}

export function SessionExpiredModal({
  isOpen,
  hasDraft,
  onReLogin,
  onClearCacheAndReload,
}: SessionExpiredModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-hover)',
          padding: '28px 24px',
          boxShadow: 'var(--shadow-popover)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          textAlign: 'center',
        }}
      >
        {/* アイコン */}
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <AlertTriangle size={28} />
        </div>

        {/* タイトル */}
        <h3
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            marginBottom: '8px',
            color: 'var(--text-primary)',
          }}
        >
          セッションの有効期限が切れました
        </h3>

        {/* 説明文 */}
        <p
          style={{
            fontSize: '0.88rem',
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            marginBottom: '20px',
          }}
        >
          Cloudflare Access の認証セッションが切れました。<br />
          下のボタンから再ログインを行ってください。
        </p>

        {/* 下書き一時保存通知バッジ */}
        {hasDraft && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(14, 165, 233, 0.1)',
              border: '1px solid rgba(14, 165, 233, 0.25)',
              color: 'var(--accent-primary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              marginBottom: '20px',
            }}
          >
            <Save size={14} />
            <span>入力中の下書きは安全に一時退避されました</span>
          </div>
        )}

        {/* アクションボタン */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={onReLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-text)',
              border: 'none',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <LogIn size={18} />
            <span>再ログインする（再読み込み）</span>
          </button>

          <button
            type="button"
            onClick={onClearCacheAndReload}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <RefreshCw size={14} />
            <span>キャッシュを完全に初期化して再試行</span>
          </button>
        </div>
      </div>
    </div>
  );
}
