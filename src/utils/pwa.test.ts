import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { clearCacheAndReload } from './pwa';
import { createPersistOptions } from './queryPersist';
import { STORAGE_KEYS } from './storage';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('clearCacheAndReload', () => {
  it('端末に保存したキャッシュを消し、保留中の保存でも書き戻さない', async () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    const location = { href: 'http://localhost/' };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { location });

    storage.setItem(STORAGE_KEYS.queryCache, '{"saved":true}');
    // キャッシュクリアの直前に始まった保存（throttle で保留中）
    const client = new QueryClient();
    client.setQueryData(['tags'], { tags: [] });
    await persistQueryClientSave({ ...createPersistOptions(), queryClient: client });

    await clearCacheAndReload();
    vi.advanceTimersByTime(1000);

    expect(storage.getItem(STORAGE_KEYS.queryCache)).toBeNull();
    expect(location.href).toMatch(/^http:\/\/localhost\/\?_reload=\d+$/);
  });
});
