import type { ToastType } from '../components/Toast';

/**
 * React の外（apiClient や QueryCache など）からトーストを表示するためのイベント
 * - ToastProvider が window の 'app-toast' イベントを購読して表示する（session-expired と同じ方式）
 */

export const APP_TOAST_EVENT = 'app-toast';

export type AppToastDetail = { type: ToastType; message: string };

export function dispatchToast(type: ToastType, message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, { detail: { type, message } }));
}
