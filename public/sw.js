const CACHE_NAME = 'post-notion-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon_light.png',
  '/icon_dark.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
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
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. APIリクエストはService Workerをバイパスして常時ネットワーク直接通信
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. ナビゲーションリクエスト（HTML）は Network-First
  // オンライン時は常にエッジへ問い合わせることで、Cloudflare Accessの認証画面へ自然に遷移させる
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // 正常なHTMLレスポンスならキャッシュを更新
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 完全オフライン時のみキャッシュフォールバック
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 3. 静的アセット（JS / CSS / 画像等）の取得
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // セキュリティチェック: JSリクエストにHTML（Accessログイン画面）が返ってきた場合はキャッシュ汚染を防ぐ
          const contentType = networkResponse.headers.get('content-type') || '';
          if (url.pathname.endsWith('.js') && contentType.includes('text/html')) {
            // セッション切れによるHTML返却のためキャッシュしない
            return networkResponse;
          }

          // 正常なアセットのみキャッシュ
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch((err) => {
          // ネットワークエラー時はキャッシュを探索
          return caches.match(event.request);
        });
    })
  );
});
