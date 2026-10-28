/**
 * localStorage アクセスの集約
 * - キー文字列は既存値を変更しない（保存済みの設定・下書きが失われるため）
 * - プライベートブラウズ・容量超過・ストレージ無効化などで例外が出ても、アプリを停止させない
 * - index.html のインラインスクリプトは React 起動前に動くため、本モジュールを使わず個別に try/catch している
 */
export const STORAGE_KEYS = {
  theme: 'post-notion-theme',
  sortOrder: 'post-notion-sort-order',
  sortPin: 'post-notion-sort-pin',
  draft: 'post-notion-draft',
  defaultPinned: 'post-notion-pref-default-pinned',
  defaultDailyReport: 'post-notion-pref-default-daily-report',
  requireTag: 'post-notion-pref-require-tag',
  queryCache: 'post-notion-query-cache',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** 値を取得する。未保存・取得失敗時は null */
export function getItem(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 値を保存する。失敗時は無視する */
export function setItem(key: StorageKey, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[storage] ${key} の保存に失敗:`, err);
  }
}

/** 値を削除する。失敗時は無視する */
export function removeItem(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] ${key} の削除に失敗:`, err);
  }
}
