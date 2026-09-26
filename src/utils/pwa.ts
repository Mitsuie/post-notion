/**
 * PWA および キャッシュ管理ユーティリティ
 */

/**
 * Service Worker の登録解除と CacheStorage の全削除を行い、
 * キャッシュバスター付きで画面を強制再読み込みします。
 */
export async function clearCacheAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch (err) {
    console.error('[pwa] キャッシュクリア失敗:', err);
  }

  // キャッシュをバイパスして強制再読み込み
  const url = new URL(window.location.href);
  url.searchParams.set('_reload', Date.now().toString());
  window.location.href = url.toString();
}

/**
 * 通常の画面再読み込み
 */
export function reloadPage(): void {
  window.location.reload();
}
