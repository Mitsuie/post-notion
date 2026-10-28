import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { SessionExpiredError, NetworkError } from './utils/apiClient';
import { dispatchToast } from './utils/toastEvents';
import { createPersistOptions, refetchRestoredQueries } from './utils/queryPersist';
import './index.css';

declare global {
  interface Window {
    __APP_MOUNTED__?: () => void;
  }
}

const queryClient = new QueryClient({
  // 一覧取得などのクエリが通信エラーで失敗した場合のみ通知する
  // （ミューテーションは各 onError が表示するため重複させない）
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof NetworkError) {
        dispatchToast('error', error.message);
      }
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // セッション失効時は無駄な再試行をせず即座にエラー扱いにする（通信エラーは1回だけ再試行）
      retry: (failureCount, error) => {
        if (error instanceof SessionExpiredError) return false;
        return failureCount < 1;
      },
    },
  },
});

const persistOptions = createPersistOptions();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* タイムラインの先頭ページとタグ一覧を端末に保存し、起動直後は前回の内容を表示しつつ裏で再取得する */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={() => refetchRestoredQueries(queryClient)}
      >
        <ToastProvider>
          <App />
        </ToastProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// 起動完了シグナル (index.html のタイムアウト監視を解除)
if (typeof window.__APP_MOUNTED__ === 'function') {
  window.__APP_MOUNTED__();
}

// PWA Service Worker 登録
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('ServiceWorker registration failed:', err);
    });
  });
}
