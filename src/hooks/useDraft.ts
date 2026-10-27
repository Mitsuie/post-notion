import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tag } from '../types';
import { debounce } from '../utils/debounce';
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

/** 入力が止まってから下書きを保存するまでの待ち時間 */
const DRAFT_SAVE_DELAY_MS = 400;

/**
 * InputBar で利用する下書き自動復元・自動保存用カスタムフック
 * - 保存はデバウンスし、ページ離脱（pagehide / visibilitychange: hidden）とアンマウント時に未保存分を即時保存する
 */
export function useDraft(availableTags: Tag[]) {
  // 復元対象の下書き（マウント時に一度だけ読み込み、復元が完了したら null にする）
  const [initialDraft] = useState(getSavedDraft);
  const pendingDraftRef = useRef<DraftData | null>(initialDraft);
  const [debouncedSave] = useState(() => debounce(saveDraftToStorage, DRAFT_SAVE_DELAY_MS));

  // ページ離脱・アンマウント時に未保存分を即時保存（PWA を閉じても入力を失わないように）
  useEffect(() => {
    const flush = () => debouncedSave.flush();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flush();
    };
  }, [debouncedSave]);

  /**
   * 初回マウント時または利用可能なタグが取得できた時に下書きを復元
   */
  const restoreDraft = useCallback(
    (onRestore: (draft: DraftData, matchedTags: Tag[]) => void) => {
      const draft = pendingDraftRef.current;
      if (!draft) return;

      const matchedTags =
        Array.isArray(draft.tagIds) && availableTags.length > 0
          ? availableTags.filter((t) => draft.tagIds.includes(t.id))
          : [];

      onRestore(draft, matchedTags);
      // タグが存在している場合、またはタグがそもそも空で取得済みの場合は復元完了とみなす
      if (availableTags.length > 0 || !draft.tagIds || draft.tagIds.length === 0) {
        pendingDraftRef.current = null;
      }
    },
    [availableTags]
  );

  /**
   * 現在の入力内容を下書きとして保存（デバウンス）
   * タグ一覧の取得前でタグを復元できていない間は、下書きのタグ ID を保持して上書きで消さない
   */
  const saveDraft = useCallback(
    (draft: Omit<DraftData, 'updatedAt'>) => {
      const pendingTagIds = pendingDraftRef.current?.tagIds;
      const keepPendingTags = draft.tagIds.length === 0 && Array.isArray(pendingTagIds) && pendingTagIds.length > 0;
      debouncedSave(keepPendingTags ? { ...draft, tagIds: pendingTagIds } : draft);
    },
    [debouncedSave]
  );

  /**
   * 現在の入力内容を下書きとして即時保存（送信失敗時の復元用）
   */
  const saveDraftNow = useCallback(
    (draft: Omit<DraftData, 'updatedAt'>) => {
      debouncedSave.cancel();
      saveDraftToStorage(draft);
    },
    [debouncedSave]
  );

  /**
   * 送信完了時に下書きをクリア
   * 待機中の保存を取り消し、送信前の内容が後から書き戻されないようにする
   */
  const clearDraft = useCallback(() => {
    debouncedSave.cancel();
    pendingDraftRef.current = null;
    clearDraftFromStorage();
  }, [debouncedSave]);

  return {
    restoreDraft,
    saveDraft,
    saveDraftNow,
    clearDraft,
  };
}
