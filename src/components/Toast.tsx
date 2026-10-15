import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'error' | 'warning' | 'info';

type ToastItem = { id: number; type: ToastType; message: string };

export interface ToastApi {
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  dismiss: () => void;
}

// 自動消去までの時間（エラー・警告は読み切れるよう長めにする）
const DURATION_MS: Record<ToastType, number> = {
  error: 8000,
  warning: 8000,
  info: 4000,
};

const ICONS: Record<ToastType, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * アプリ全体の通知（トースト）を提供するプロバイダー
 * - 同時表示は1件（新しい通知で置き換え）
 * - 表示中と同じ内容が来た場合はタイマーのみ延長する
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextIdRef = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const show = useCallback((type: ToastType, message: string) => {
    setToast((prev) =>
      prev && prev.type === type && prev.message === message
        ? prev
        : { id: ++nextIdRef.current, type, message }
    );
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), DURATION_MS[type]);
  }, []);

  // アンマウント時にタイマーを破棄
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const api = useMemo<ToastApi>(
    () => ({
      error: (message) => show('error', message),
      warning: (message) => show('warning', message),
      info: (message) => show('info', message),
      dismiss,
    }),
    [show, dismiss]
  );

  const Icon = toast ? ICONS[toast.type] : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && Icon && (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}`}
          role={toast.type === 'info' ? 'status' : 'alert'}
        >
          <Icon size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{toast.message}</span>
          <button type="button" className="toast__close" onClick={dismiss} aria-label="通知を閉じる">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// 任意のコンポーネントから通知を表示するフック（ToastProvider の内側で使用する）
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast は ToastProvider の内側で使用してください');
  }
  return ctx;
}
