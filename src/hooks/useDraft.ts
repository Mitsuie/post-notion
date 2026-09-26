import { useCallback, useRef } from 'react';
import type { Tag } from '../types';

const DRAFT_STORAGE_KEY = 'post-notion-draft';

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
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
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
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftData) : null;
  } catch {
    return null;
  }
}

/**
 * 下書きをストレージに保存（空の場合は削除）
 */
export function saveDraftToStorage(draft: Omit<DraftData, 'updatedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    if (draft.title.trim() || draft.body.trim() || draft.tagIds.length > 0) {
      const data: DraftData = {
        ...draft,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[useDraft] 下書きの保存に失敗:', err);
  }
}

/**
 * 下書きをストレージから完全削除
 */
export function clearDraftFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (err) {
    console.warn('[useDraft] 下書きの削除に失敗:', err);
  }
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
