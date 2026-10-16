import { useCallback, useRef } from 'react';
import type { Tag } from '../types';
import { getItem, removeItem, setItem, STORAGE_KEYS } from '../utils/storage';

export interface DraftData {
  title: string;
  body: string;
  tagIds: string[];
  pinned: boolean;
  linkDailyReport: boolean;
  updatedAt?: string;
}

/**
 * 下書きがストレージに存在するかどうかを安全に確認
 */
export function checkHasDraft(): boolean {
  try {
    const raw = getItem(STORAGE_KEYS.draft);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(
      (parsed.title && parsed.title.trim().length > 0) ||
      (parsed.body && parsed.body.trim().length > 0) ||
      (Array.isArray(parsed.tagIds) && parsed.tagIds.length > 0)
    );
  } catch {
    return false;
  }
}

/**
 * ストレージから下書きデータを取得
 */
export function getSavedDraft(): DraftData | null {
  try {
    const raw = getItem(STORAGE_KEYS.draft);
    return raw ? (JSON.parse(raw) as DraftData) : null;
  } catch {
    return null;
  }
}

/**
 * 下書きをストレージに保存（空の場合は削除）
 */
export function saveDraftToStorage(draft: Omit<DraftData, 'updatedAt'>): void {
  if (draft.title.trim() || draft.body.trim() || draft.tagIds.length > 0) {
    const data: DraftData = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.draft, JSON.stringify(data));
  } else {
    removeItem(STORAGE_KEYS.draft);
  }
}

/**
 * 下書きをストレージから完全削除
 */
export function clearDraftFromStorage(): void {
  removeItem(STORAGE_KEYS.draft);
}

/**
 * InputBar で利用する下書き自動復元・自動保存用カスタムフック
 */
export function useDraft(availableTags: Tag[]) {
  const isRestoredRef = useRef(false);

  /**
   * 初回マウント時または利用可能なタグが取得できた時に下書きを復元
   */
  const restoreDraft = useCallback(
    (onRestore: (draft: DraftData, matchedTags: Tag[]) => void) => {
      if (isRestoredRef.current) return;
      const draft = getSavedDraft();
      if (!draft) return;

      const matchedTags =
        Array.isArray(draft.tagIds) && availableTags.length > 0
          ? availableTags.filter((t) => draft.tagIds.includes(t.id))
          : [];

      onRestore(draft, matchedTags);
      // タグが存在している場合、またはタグがそもそも空で取得済みの場合は復元完了とみなす
      if (availableTags.length > 0 || !draft.tagIds || draft.tagIds.length === 0) {
        isRestoredRef.current = true;
      }
    },
    [availableTags]
  );

  /**
   * 現在の入力内容を下書きとして保存
   */
  const saveDraft = useCallback((draft: Omit<DraftData, 'updatedAt'>) => {
    saveDraftToStorage(draft);
  }, []);

  /**
   * 送信完了時に下書きをクリア
   */
  const clearDraft = useCallback(() => {
    clearDraftFromStorage();
  }, []);

  return {
    restoreDraft,
    saveDraft,
    clearDraft,
    hasDraft: checkHasDraft(),
  };
}
