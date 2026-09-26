import { AlertTriangle, LogIn, RefreshCw, Save } from 'lucide-react';
import './SessionExpiredModal.css';

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
    <div className="session-expired-overlay">
      <div className="glass session-expired-card">
        {/* アイコン */}
        <div className="session-expired-icon-wrap">
          <AlertTriangle size={28} />
        </div>

        {/* タイトル */}
        <h3 className="session-expired-title">
          セッションの有効期限が切れました
        </h3>

        {/* 説明文 */}
        <p className="session-expired-desc">
          Cloudflare Access の認証セッションが切れました。<br />
          下のボタンから再ログインを行ってください。
        </p>

        {/* 下書き一時保存通知バッジ */}
        {hasDraft && (
          <div className="session-expired-draft-badge">
            <Save size={14} />
            <span>入力中の下書きは安全に一時退避されました</span>
          </div>
        )}

        {/* アクションボタン */}
        <div className="session-expired-actions">
          <button
            type="button"
            className="session-expired-btn-primary"
            onClick={onReLogin}
          >
            <LogIn size={18} />
            <span>再ログインする（再読み込み）</span>
          </button>

          <button
            type="button"
            className="session-expired-btn-secondary"
            onClick={onClearCacheAndReload}
          >
            <RefreshCw size={14} />
            <span>キャッシュを完全に初期化して再試行</span>
          </button>
        </div>
      </div>
    </div>
  );
}
