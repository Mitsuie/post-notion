const CACHE_NAME = 'post-notion-v3';

// ナビゲーション（HTML）のキャッシュキー。?_reload=... 等のクエリ付きエントリを作らないよう常にこのキーへ保存する
const APP_SHELL_KEY = '/index.html';

// Cache-First で扱うハッシュなしの静的ファイル（Vite のハッシュ付きファイルは /assets/ 配下で別途判定）
// 内容を変更した場合は CACHE_NAME を更新して入れ替える
const STATIC_FILES = [
  '/manifest.json',
  '/icon_light.png',
  '/icon_dark.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];
const STATIC_FILE_SET = new Set(STATIC_FILES);

// 同一オリジン・リダイレクトなし・200 の応答のみ保存する
// （Cloudflare Pages は /index.html を / へリダイレクトするため、リダイレクト後の応答はナビゲーションに使えない）
function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic' && !response.redirected;
}

// 新しい index.html を保存し、その HTML が参照していない /assets/* をキャッシュから削除する
async function updateAppShell(response) {
  const cache = await caches.open(CACHE_NAME);
  const html = await response.clone().text();
  await cache.put(APP_SHELL_KEY, response);

  const referenced = new Set(html.match(/\/assets\/[^"'\s?#)]+/g) || []);
  const requests = await cache.keys();
  await Promise.all(
    requests.map((request) => {
      const { pathname } = new URL(request.url);
      if (pathname.startsWith('/assets/') && !referenced.has(pathname)) {
        return cache.delete(request);
      }
      return undefined;
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 1 件の失敗（セッション切れ等）でインストール全体を失敗させない
      await Promise.allSettled([
        ...STATIC_FILES.map((path) => cache.add(path)),
        fetch('/', { cache: 'reload' }).then((res) => (isCacheable(res) ? updateAppShell(res) : undefined)),
      ]);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 同一オリジン以外（Google Fonts 等）と API は Service Worker を経由させない
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // 1. ナビゲーションリクエスト（HTML）は Network-First
  // オンライン時は常にエッジへ問い合わせることで、Cloudflare Accessの認証画面へ自然に遷移させる
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // 正常なHTMLレスポンスならキャッシュを更新し、参照されなくなった旧アセットを削除
          if (isCacheable(networkResponse)) {
            event.waitUntil(updateAppShell(networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch(async () => {
          // 完全オフライン時のみキャッシュフォールバック
          return (await caches.match(APP_SHELL_KEY)) || Response.error();
        })
    );
    return;
  }

  // 2. Vite のハッシュ付きファイルとアイコン・マニフェストのみ Cache-First。それ以外は経由させない
  if (!url.pathname.startsWith('/assets/') && !STATIC_FILE_SET.has(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!isCacheable(networkResponse)) {
          return networkResponse;
        }

        // セキュリティチェック: アセットにHTML（Accessログイン画面）が返ってきた場合はキャッシュ汚染を防ぐ
        const contentType = networkResponse.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache)));
        return networkResponse;
      });
    })
  );
});
