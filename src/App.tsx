import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, X, Menu } from 'lucide-react';
import { usePosts } from './hooks/usePosts';
import { useTags } from './hooks/useTags';
import { checkHasDraft } from './hooks/useDraft';
import { clearCacheAndReload, reloadPage } from './utils/pwa';
import { InputBar } from './components/InputBar';
import { Timeline } from './components/Timeline';
import { Logo } from './components/Logo';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SessionExpiredModal } from './components/SessionExpiredModal';

export default function App() {
  const queryClient = useQueryClient();
  const { data: postsData, isLoading: isPostsLoading, createPost, isCreating, togglePin } = usePosts();
  const { data: tagsData } = useTags();

  // テーマ管理（白ベース / ライトモードをデフォルト）
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('post-notion-theme') as 'light' | 'dark') || 'light';
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const posts = postsData?.posts || [];
  const tags = tagsData?.tags || [];
  const isTagsConfigured = tagsData?.configured !== false;

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // 投稿送信ハンドラ
  const handlePostSubmit = (input: { title: string; tagIds?: string[]; pinned?: boolean }) => {
    createPost(input, {
      onError: (err: any) => {
        setErrorMessage(err.message || '投稿の送信に失敗しました');
      },
    });
  };

  // ピン留め切り替えハンドラ
  const handleTogglePin = (id: string, pinned: boolean) => {
    togglePin(
      { id, pinned },
      {
        onError: (err: any) => {
          setErrorMessage(err.message || 'ピン留めの更新に失敗しました');
        },
      }
    );
  };

  // 手動リフレッシュ
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['posts'] }),
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['status'] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // 再ログイン実行ハンドラ
  const handleReLogin = () => {
    reloadPage();
  };

  // キャッシュクリア＆再ログイン実行ハンドラ
  const handleClearCacheAndReload = () => {
    clearCacheAndReload();
  };

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

      {/* エラートースト通知 */}
      {errorMessage && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(max(env(safe-area-inset-top, 0px), 16px) + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'var(--danger)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-popover)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            maxWidth: '90%',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

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
          onClick={() => setIsSettingsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="設定メニューを開く"
          aria-label="設定メニューを開く"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.background = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.background = 'var(--bg-secondary)';
          }}
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
      />

      {/* メインコンテンツ */}
      <main>
        {/* 高速投稿入力フォーム */}
        <InputBar
          availableTags={tags}
          isTagsConfigured={isTagsConfigured}
          onSubmit={handlePostSubmit}
          isSubmitting={isCreating}
        />

        {/* タイムライン */}
        <Timeline
          posts={posts}
          availableTags={tags}
          isTagsConfigured={isTagsConfigured}
          isLoading={isPostsLoading}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onTogglePin={handleTogglePin}
        />
      </main>
    </div>
  );
}
