import { afterEach, describe, expect, it, vi } from 'vitest';
import { getItem, removeItem, setItem, STORAGE_KEYS } from './storage';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('storage', () => {
  it('既存のキー文字列を維持している', () => {
    expect(STORAGE_KEYS).toEqual({
      theme: 'post-notion-theme',
      sortOrder: 'post-notion-sort-order',
      sortPin: 'post-notion-sort-pin',
      draft: 'post-notion-draft',
      defaultPinned: 'post-notion-pref-default-pinned',
      defaultDailyReport: 'post-notion-pref-default-daily-report',
      requireTag: 'post-notion-pref-require-tag',
      queryCache: 'post-notion-query-cache',
    });
  });

  it('保存・取得・削除ができる', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    expect(getItem(STORAGE_KEYS.theme)).toBeNull();
    setItem(STORAGE_KEYS.theme, 'dark');
    expect(getItem(STORAGE_KEYS.theme)).toBe('dark');
    removeItem(STORAGE_KEYS.theme);
    expect(getItem(STORAGE_KEYS.theme)).toBeNull();
  });

  it('ストレージが例外を投げても呼び出し側へ伝播しない', () => {
    vi.stubGlobal('localStorage', throwingStorage);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getItem(STORAGE_KEYS.draft)).toBeNull();
    expect(() => setItem(STORAGE_KEYS.draft, '{}')).not.toThrow();
    expect(() => removeItem(STORAGE_KEYS.draft)).not.toThrow();
  });

  it('localStorage が存在しない環境でも null を返す', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getItem(STORAGE_KEYS.sortOrder)).toBeNull();
  });
});
