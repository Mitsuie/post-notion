import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { usePostMutations } from './hooks/usePosts';
import { useTags } from './hooks/useTags';
import { checkHasDraft } from './hooks/useDraft';
import { clearCacheAndReload, reloadPage } from './utils/pwa';
import { POSTS_QUERY_KEY } from './utils/postsCache';
import { InputBar } from './components/InputBar';
import { Timeline } from './components/Timeline';
import { Logo } from './components/Logo';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SessionExpiredModal } from './components/SessionExpiredModal';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { useToast } from './components/Toast';
import { useSystemStatus } from './hooks/useSystemStatus';
import { useUserPreferences } from './hooks/useUserPreferences';
import type { CreatePostInput } from './types';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

export default function App() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { createPost, isCreating, togglePin } = usePostMutations();
  const { data: tagsData } = useTags();
  const {
    isDailyReportConfigured,
    isTagsConfigured: isSystemTagsConfigured,
    isDailyReportAccessible,
    isTagsAccessible: isSystemTagsAccessible,
  } = useSystemStatus();
  const { preferences, setDefaultPinned, setDefaultDailyReport, setRequireTag } = useUserPreferences();

  // テーマ管理（白ベース / ライトモードをデフォルト）
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('post-notion-theme') as 'light' | 'dark') || 'light';
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const tags = tagsData?.tags || [];
  // タグDBが明示的に設定されている場合のみ有効判定（安全サイド）
  const isTagsConfigured = tagsData ? tagsData.configured === true : Boolean(isSystemTagsConfigured);
  // タグDBがアクセス可能（シークレット設定済み かつ 接続疎通OK）か判定
  const isTagsAccessible = isTagsConfigured && (isSystemTagsAccessible ?? (tags.length > 0 || !tagsData));

  // テーマ変更を HTML data-theme 属性、localStorage、favicon、theme-color meta に同期
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('post-notion-theme', theme);

    const favicon = document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (favicon) {
      favicon.href = theme === 'dark' ? '/icon_dark.png' : '/icon_light.png';
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#0a0f1d' : '#f8fafc');
    }
  }, [theme]);

  // セッション失効イベント (session-expired) のグローバル購読
  useEffect(() => {
    const handleSessionExpired = () => {
      setIsSessionExpired(true);
    };

    window.addEventListener('session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // 投稿送信ハンドラ
  const handlePostSubmit = useCallback(
    (
      input: CreatePostInput,
      options?: { onError?: (err: unknown) => void; onSuccess?: () => void }
    ) => {
      createPost(input, {
        onError: (err: unknown) => {
          const msg = getErrorMessage(err, '投稿の送信に失敗しました');
          toast.error(`${msg}（入力内容を復元しました）`);
          options?.onError?.(err);
        },
        onSuccess: (data) => {
          // 投稿は成功したが日報未連携・本文の一部追記失敗などがあった場合は警告する
          if (data?.warning) {
            toast.warning(data.warning);
          }
          options?.onSuccess?.();
        },
      });
    },
    [createPost, toast]
  );

  // ピン留め切り替えハンドラ
  const handleTogglePin = useCallback(
    (id: string, pinned: boolean) => {
      togglePin(
        { id, pinned },
        {
          onError: (err: unknown) => {
            const msg = getErrorMessage(err, 'ピン留めの更新に失敗しました');
            toast.error(msg);
          },
        }
      );
    },
    [togglePin, toast]
  );

  // 手動リフレッシュ
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: POSTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['system-status'] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  }, [queryClient]);

  // 再ログイン実行ハンドラ
  const handleReLogin = useCallback(() => {
    reloadPage();
  }, []);

  // キャッシュクリア＆再ログイン実行ハンドラ
  const handleClearCacheAndReload = useCallback(() => {
    clearCacheAndReload();
  }, []);

  const hasDraft = checkHasDraft();

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 16px)',
        minHeight: '100dvh',
      }}
    >
      {/* セッション失効モーダル */}
      <SessionExpiredModal
        isOpen={isSessionExpired}
        hasDraft={hasDraft}
        onReLogin={handleReLogin}
        onClearCacheAndReload={handleClearCacheAndReload}
      />

      {/* ヘッダー */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <Logo size="md" />
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            パーソナルSNS風ナレッジ収集基盤
          </p>
        </div>

        {/* 設定用ハンバーガーメニューボタン */}
        <button
          type="button"
          className="icon-btn-secondary"
          onClick={() => setIsSettingsOpen(true)}
          title="設定メニューを開く"
          aria-label="設定メニューを開く"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* 設定ドロワー */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefreshAll={handleRefresh}
        isRefreshingAll={isRefreshing}
        preferences={preferences}
        onSetDefaultPinned={setDefaultPinned}
        onSetDefaultDailyReport={setDefaultDailyReport}
        onSetRequireTag={setRequireTag}
        isDailyReportConfigured={isDailyReportConfigured}
        isTagsConfigured={isTagsConfigured}
        isDailyReportAccessible={isDailyReportAccessible}
        isTagsAccessible={isTagsAccessible}
      />

      {/* メインコンテンツ */}
      <main>
        {/* 高速投稿入力フォーム */}
        <InputBar
          availableTags={tags}
          isTagsConfigured={isTagsAccessible}
          isDailyReportConfigured={isDailyReportAccessible}
          tagLimit={tagsData?.limit}
          defaultPinned={preferences.defaultPinned}
          defaultDailyReport={preferences.defaultDailyReport}
          requireTag={preferences.requireTag}
          onSubmit={handlePostSubmit}
          isSubmitting={isCreating}
        />

        {/* タイムライン */}
        <Timeline
          availableTags={tags}
          isTagsConfigured={isTagsAccessible}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onTogglePin={handleTogglePin}
        />
      </main>

      {/* ページ上部へ戻るボタン */}
      <ScrollToTopButton />
    </div>
  );
}
