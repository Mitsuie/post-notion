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

export interface DraftRestoreOptions {
  isDailyReportConfigured: boolean;
  defaultPinned: boolean;
  defaultDailyReport: boolean;
}

/** 下書きから入力欄へ復元する値（undefined の項目は変更しない） */
export interface DraftRestoreValues {
  title?: string;
  body?: string;
  pinned?: boolean;
  linkDailyReport?: boolean;
  tags: Tag[];
}

/**
 * 下書きから復元する値を決める
 * - 初回: タイトル・本文・ピン留め・日報連携と、取得済みならタグを復元する
 * - 2 回目以降（タグ一覧の取得待ちの再評価）: タグだけを復元し、その間に利用者が変えた入力を巻き戻さない
 * - タグ一覧を取得できた、または下書きにタグがなければ復元完了（isComplete）とする
 */
export function getDraftRestoreValues(
  draft: DraftData,
  availableTags: Tag[],
  isFirstRestore: boolean,
  options: DraftRestoreOptions
): { values: DraftRestoreValues; isComplete: boolean } {
  const hasTagIds = Array.isArray(draft.tagIds) && draft.tagIds.length > 0;
  const tags = hasTagIds && availableTags.length > 0 ? availableTags.filter((t) => draft.tagIds.includes(t.id)) : [];
  const isComplete = availableTags.length > 0 || !hasTagIds;

  if (!isFirstRestore) return { values: { tags }, isComplete };

  const { isDailyReportConfigured, defaultPinned, defaultDailyReport } = options;
  const linkDailyReport = typeof draft.linkDailyReport === 'boolean' ? draft.linkDailyReport : defaultDailyReport;
  return {
    values: {
      title: draft.title || undefined,
      body: draft.body || undefined,
      pinned: typeof draft.pinned === 'boolean' ? draft.pinned : defaultPinned,
      linkDailyReport: isDailyReportConfigured ? linkDailyReport : false,
      tags,
    },
    isComplete,
  };
}

/**
 * 保存する下書きに、復元待ちのタグ ID を引き継ぐ
 * タグ一覧の取得前でタグを復元できていない間に、タグなしの内容で上書きして消さないようにする
 */
export function withPendingTagIds(
  draft: Omit<DraftData, 'updatedAt'>,
  pendingDraft: DraftData | null
): Omit<DraftData, 'updatedAt'> {
  const pendingTagIds = pendingDraft?.tagIds;
  if (draft.tagIds.length > 0 || !Array.isArray(pendingTagIds) || pendingTagIds.length === 0) return draft;
  return { ...draft, tagIds: pendingTagIds };
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
  const isFirstRestoreRef = useRef(true);
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
    (options: DraftRestoreOptions, onRestore: (values: DraftRestoreValues) => void) => {
      const draft = pendingDraftRef.current;
      if (!draft) return;

      const { values, isComplete } = getDraftRestoreValues(draft, availableTags, isFirstRestoreRef.current, options);
      isFirstRestoreRef.current = false;
      onRestore(values);
      if (isComplete) pendingDraftRef.current = null;
    },
    [availableTags]
  );

  /**
   * 現在の入力内容を下書きとして保存（デバウンス）
   */
  const saveDraft = useCallback(
    (draft: Omit<DraftData, 'updatedAt'>) => {
      debouncedSave(withPendingTagIds(draft, pendingDraftRef.current));
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
