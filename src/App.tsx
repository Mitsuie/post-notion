import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { usePostMutations } from './hooks/usePosts';
import { useTags } from './hooks/useTags';
import { checkHasDraft } from './hooks/useDraft';
import { clearCacheAndReload, reloadPage } from './utils/pwa';
import { POSTS_QUERY_KEY } from './utils/postsCache';
import { getPostErrorMessage } from './utils/postErrors';
import { getItem, setItem, STORAGE_KEYS } from './utils/storage';
import { InputBar } from './components/InputBar';
import { Timeline } from './components/Timeline';
import { Logo } from './components/Logo';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SessionExpiredModal } from './components/SessionExpiredModal';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { useToast } from './components/Toast';
import { useAppConfig } from './hooks/useAppConfig';
import { useUserPreferences } from './hooks/useUserPreferences';
import type { CreatePostInput } from './types';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

export default function App() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { createPost, isCreating, togglePin, archivePost, updateTitle } = usePostMutations();
  const { data: tagsData } = useTags();
  // 起動時は接続診断（/api/status）を呼ばず、環境変数による設定有無だけを取得する
  // （接続状況は設定ドロワーを開いたときに SettingsDrawer 内で取得する）
  const { data: appConfig } = useAppConfig();
  const { preferences, setDefaultPinned, setDefaultDailyReport, setRequireTag } = useUserPreferences();

  // テーマ管理（保存値がなければ OS のカラースキームに従う。index.html のインラインスクリプトと同じ判定）
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (getItem(STORAGE_KEYS.theme) as 'light' | 'dark') || getSystemTheme();
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const tags = tagsData?.tags || [];
  // タグDBが利用可能（設定済み かつ /api/tags の取得に成功）か判定
  // （/api/tags の configured は /api/config と同じ環境変数で判定されるため、/api/config の応答を待たない）
  const isTagsAccessible = tagsData?.configured === true;
  // タグDB / 日報DB が明示的に設定されている場合のみ有効判定（安全サイド）
  const isTagsConfigured = appConfig?.tagsConfigured === true || isTagsAccessible;
  const isDailyReportConfigured = appConfig?.dailyReportConfigured === true;
  // 日報DBは設定済みなら利用可能とする（接続できない場合は投稿時の警告で伝わる）
  const isDailyReportAccessible = isDailyReportConfigured;

  // テーマ変更を HTML data-theme 属性、favicon、theme-color meta に同期
  // （保存はユーザーが切り替えたときのみ。未保存の間は OS 設定の変更に追従させる）
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

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

  // 保存値がない間は OS のカラースキーム変更に追従
  useEffect(() => {
    const media = window.matchMedia(DARK_SCHEME_QUERY);
    const handleChange = (e: MediaQueryListEvent) => {
      if (getItem(STORAGE_KEYS.theme) === null) setTheme(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      setItem(STORAGE_KEYS.theme, next);
      return next;
    });
  }, []);

  // 投稿送信ハンドラ
  const handlePostSubmit = useCallback(
    (
      input: CreatePostInput,
      options?: { onError?: (err: unknown) => void; onSuccess?: () => void }
    ) => {
      createPost(input, {
        onError: (err: unknown) => {
          // 通信エラー時の投稿一覧の再取得は、usePostMutations の onSettled が行う
          toast.error(getPostErrorMessage(err));
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

  // 投稿のアーカイブ（削除）ハンドラ
  const handleArchive = useCallback(
    (id: string) => {
      archivePost(id, {
        onSuccess: () => {
          toast.info('投稿を削除しました');
        },
        onError: (err: unknown) => {
          toast.error(getErrorMessage(err, '投稿の削除に失敗しました'));
        },
      });
    },
    [archivePost, toast]
  );

  // タイトル変更ハンドラ
  const handleUpdateTitle = useCallback(
    (id: string, title: string) => {
      updateTitle(
        { id, title },
        {
          onError: (err: unknown) => {
            toast.error(getErrorMessage(err, 'タイトルの更新に失敗しました'));
          },
        }
      );
    },
    [updateTitle, toast]
  );

  // 手動リフレッシュ
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: POSTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['app-config'] }),
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
        isDailyReportAccessible={isDailyReportConfigured}
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
          onArchive={handleArchive}
          onUpdateTitle={handleUpdateTitle}
        />
      </main>

      {/* ページ上部へ戻るボタン */}
      <ScrollToTopButton />
    </div>
  );
}
