import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SessionExpiredError } from './utils/apiClient';
import './index.css';

declare global {
  interface Window {
    __APP_MOUNTED__?: () => void;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // セッション失効時は無駄な再試行をせず即座にエラー扱いにする
      retry: (failureCount, error) => {
        if (error instanceof SessionExpiredError) return false;
        return failureCount < 1;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
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
