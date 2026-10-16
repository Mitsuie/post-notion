import { useEffect, useRef } from 'react';
import { AlertTriangle, LogIn, RefreshCw, Save } from 'lucide-react';
import './SessionExpiredModal.css';

interface SessionExpiredModalProps {
  isOpen: boolean;
  hasDraft?: boolean;
  onReLogin: () => void;
  onClearCacheAndReload: () => void;
}

/**
 * セッション失効モーダル（ネイティブ <dialog> + showModal）
 * - 表示中は背景の要素にフォーカスが移らない（top layer のモーダルダイアログ）
 * - 再ログインの導線を失わないよう、Esc では閉じさせない
 */
export function SessionExpiredModal({
  isOpen,
  hasDraft,
  onReLogin,
  onClearCacheAndReload,
}: SessionExpiredModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // isOpen の変化を showModal() / close() に反映
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="session-expired-dialog"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
      // Esc による閉じる操作を無効化する
      onCancel={(e) => e.preventDefault()}
      // ブラウザの制約で閉じられた場合も、表示中であれば開き直す
      onClose={() => {
        if (isOpen) dialogRef.current?.showModal();
      }}
    >
      {isOpen && (
        <div className="glass session-expired-card">
          {/* アイコン */}
          <div className="session-expired-icon-wrap">
            <AlertTriangle size={28} aria-hidden="true" />
          </div>

          {/* タイトル */}
          <h3 id="session-expired-title" className="session-expired-title">
            認証セッションが切れた可能性があります
          </h3>

          {/* 説明文 */}
          <p id="session-expired-desc" className="session-expired-desc">
            Cloudflare Access の認証セッションが切れた可能性があります。<br />
            下のボタンから再ログインを行ってください。
          </p>

          {/* 下書き一時保存通知バッジ */}
          {hasDraft && (
            <div className="session-expired-draft-badge">
              <Save size={14} aria-hidden="true" />
              <span>入力中の下書きは安全に一時退避されました</span>
            </div>
          )}

          {/* アクションボタン */}
          <div className="session-expired-actions">
            <button
              type="button"
              className="session-expired-btn-primary"
              onClick={onReLogin}
              autoFocus
            >
              <LogIn size={18} aria-hidden="true" />
              <span>再ログインする（再読み込み）</span>
            </button>

            <button
              type="button"
              className="session-expired-btn-secondary"
              onClick={onClearCacheAndReload}
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>キャッシュを完全に初期化して再試行</span>
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
