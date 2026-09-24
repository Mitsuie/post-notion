import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, RefreshCw, X, Sun, Moon } from 'lucide-react';
import { usePosts } from './hooks/usePosts';
import { useTags } from './hooks/useTags';
import { InputBar } from './components/InputBar';
import { Timeline } from './components/Timeline';
import { Logo } from './components/Logo';

export default function App() {
  const queryClient = useQueryClient();
  const { data: postsData, isLoading: isPostsLoading, createPost, isCreating, togglePin } = usePosts();
  const { data: tagsData, isLoading: isTagsLoading, error: tagsError } = useTags();

  // テーマ管理（白ベース / ライトモードをデフォルト）
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('post-notion-theme') as 'light' | 'dark') || 'light';
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const posts = postsData?.posts || [];
  const tags = tagsData?.tags || [];

  // テーマ変更を HTML data-theme 属性、localStorage、favicon に同期
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('post-notion-theme', theme);

    const favicon = document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (favicon) {
      favicon.href = theme === 'dark' ? '/icon_dark.png' : '/icon_light.png';
    }
  }, [theme]);

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
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px', minHeight: '100vh' }}>
      {/* エラートースト通知 */}
      {errorMessage && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
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
            摩擦ゼロのパーソナルSNS風ナレッジ収集基盤
          </p>
        </div>

        {/* コントロール群（同期ステータス & テーマ切り替え） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 接続ステータスバッジ */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
            }}
          >
            {isTagsLoading ? (
              <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            ) : tagsError ? (
              <>
                <AlertCircle size={12} style={{ color: 'var(--danger)' }} />
                <span style={{ color: 'var(--danger)', fontWeight: 500 }}>Notionエラー</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>同期中</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  ({tags.length}タグ)
                </span>
              </>
            )}
          </div>

          {/* テーマ切り替えボタン（ライト ☀️ / ダーク 🌙） */}
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'var(--border-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main>
        {/* 高速投稿入力フォーム */}
        <InputBar
          availableTags={tags}
          onSubmit={handlePostSubmit}
          isSubmitting={isCreating}
        />

        {/* タイムライン */}
        <Timeline
          posts={posts}
          availableTags={tags}
          isLoading={isPostsLoading}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onTogglePin={handleTogglePin}
        />
      </main>
    </div>
  );
}
