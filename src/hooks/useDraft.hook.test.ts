// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { Tag } from '../types';
import { STORAGE_KEYS } from '../utils/storage';
import { useDraft, type DraftData, type DraftRestoreOptions } from './useDraft';

const tagA: Tag = { id: 'tag-a', name: 'A' };
const tagB: Tag = { id: 'tag-b', name: 'B' };
const NO_TAGS: Tag[] = [];

const options: DraftRestoreOptions = {
  isDailyReportConfigured: true,
  defaultPinned: false,
  defaultDailyReport: true,
};

const input = { title: '入力中', body: '本文', tagIds: ['tag-a'], pinned: true, linkDailyReport: false };
const empty = { title: '', body: '', tagIds: [] as string[], pinned: false, linkDailyReport: true };

function stored(): DraftData | null {
  const raw = localStorage.getItem(STORAGE_KEYS.draft);
  return raw ? (JSON.parse(raw) as DraftData) : null;
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  setVisibility('visible');
});

describe('useDraft の保存', () => {
  it('入力が止まってから 400ms 後に、最後の入力内容だけを保存する', () => {
    const { result } = renderHook(() => useDraft(NO_TAGS));

    act(() => {
      result.current.saveDraft({ ...input, title: '途中' });
      result.current.saveDraft(input);
    });
    vi.advanceTimersByTime(399);
    expect(stored()).toBeNull();

    vi.advanceTimersByTime(1);
    expect(stored()).toMatchObject(input);
    expect(stored()?.updatedAt).toEqual(expect.any(String));
  });

  it('待機中の保存は、ページ離脱（pagehide・visibilitychange: hidden）とアンマウントで即時に書き込む', () => {
    const { result, unmount } = renderHook(() => useDraft(NO_TAGS));

    act(() => result.current.saveDraft({ ...input, title: 'pagehide' }));
    window.dispatchEvent(new Event('pagehide'));
    expect(stored()?.title).toBe('pagehide');

    act(() => result.current.saveDraft({ ...input, title: 'hidden' }));
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(stored()?.title).toBe('hidden');

    act(() => result.current.saveDraft({ ...input, title: 'unmount' }));
    unmount();
    expect(stored()?.title).toBe('unmount');
  });

  it('表示中に戻っただけ（visibilitychange: visible）では書き込まない', () => {
    const { result } = renderHook(() => useDraft(NO_TAGS));

    act(() => result.current.saveDraft(input));
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(stored()).toBeNull();
  });

  it('入力が空になったら、保存済みの下書きを削除する', () => {
    // タグ付きの下書きはタグの復元待ちとして残すため、タグなしの下書きで確かめる
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ ...input, tagIds: [] }));
    const { result } = renderHook(() => useDraft(NO_TAGS));

    act(() => result.current.saveDraft(empty));
    vi.advanceTimersByTime(400);
    expect(stored()).toBeNull();
  });
});

describe('useDraft の復元', () => {
  it('タグ一覧の取得前は入力欄だけを復元し、取得後にタグを復元する。復元後は再び適用しない', () => {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(input));
    const { result, rerender } = renderHook(({ tags }) => useDraft(tags), { initialProps: { tags: NO_TAGS } });
    const onRestore = vi.fn();

    act(() => result.current.restoreDraft(options, onRestore));
    expect(onRestore).toHaveBeenLastCalledWith({
      title: '入力中',
      body: '本文',
      pinned: true,
      linkDailyReport: false,
      tags: [],
    });

    rerender({ tags: [tagA, tagB] });
    act(() => result.current.restoreDraft(options, onRestore));
    expect(onRestore).toHaveBeenLastCalledWith({ tags: [tagA] });

    act(() => result.current.restoreDraft(options, onRestore));
    expect(onRestore).toHaveBeenCalledTimes(2);
  });

  it('タグの復元待ちの間に保存しても、下書きのタグを消さない', () => {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(input));
    const { result } = renderHook(() => useDraft(NO_TAGS));

    act(() => {
      result.current.restoreDraft(options, () => {});
      result.current.saveDraft({ ...input, title: '編集後', tagIds: [] });
    });
    vi.advanceTimersByTime(400);
    expect(stored()).toMatchObject({ title: '編集後', tagIds: ['tag-a'] });
  });

  it('下書きがなければ、復元の処理を呼ばない', () => {
    const { result } = renderHook(() => useDraft([tagA]));
    const onRestore = vi.fn();

    act(() => result.current.restoreDraft(options, onRestore));
    expect(onRestore).not.toHaveBeenCalled();
  });
});

describe('useDraft の送信時の取り消し', () => {
  it('送信（clearDraft）で下書きを削除し、待機中の保存が後から書き戻さない', () => {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ ...input, title: '以前の下書き' }));
    const { result, unmount } = renderHook(() => useDraft(NO_TAGS));

    act(() => {
      result.current.saveDraft(input);
      result.current.clearDraft();
    });
    expect(stored()).toBeNull();

    vi.advanceTimersByTime(400);
    window.dispatchEvent(new Event('pagehide'));
    unmount();
    expect(stored()).toBeNull();
  });

  it('送信後は、タグ一覧の取得が遅れても以前の下書きを復元しない', () => {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(input));
    const { result, rerender } = renderHook(({ tags }) => useDraft(tags), { initialProps: { tags: NO_TAGS } });
    const onRestore = vi.fn();

    act(() => {
      result.current.restoreDraft(options, onRestore);
      result.current.clearDraft();
    });
    rerender({ tags: [tagA] });
    act(() => result.current.restoreDraft(options, onRestore));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('送信失敗時（saveDraftNow）は待機中の保存を取り消し、送信前の内容を即時に保存する', () => {
    const { result } = renderHook(() => useDraft(NO_TAGS));

    act(() => {
      result.current.clearDraft();
      result.current.saveDraft(empty);
      result.current.saveDraftNow(input);
    });
    expect(stored()).toMatchObject(input);

    vi.advanceTimersByTime(400);
    expect(stored()).toMatchObject(input);
  });
});
