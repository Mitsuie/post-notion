import { Sun, Moon } from 'lucide-react';

interface ThemeSectionProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function ThemeSection({ theme, onToggleTheme }: ThemeSectionProps) {
  return (
    <section>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '10px',
        }}
      >
        外観 (Appearance)
      </div>
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-tertiary)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          gap: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => theme !== 'light' && onToggleTheme()}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: theme === 'light' ? 600 : 400,
            background: theme === 'light' ? 'var(--bg-card)' : 'transparent',
            color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Sun size={15} style={{ color: theme === 'light' ? '#f59e0b' : 'inherit' }} />
          <span>ライト</span>
        </button>

        <button
          type="button"
          onClick={() => theme !== 'dark' && onToggleTheme()}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: theme === 'dark' ? 600 : 400,
            background: theme === 'dark' ? 'var(--bg-card)' : 'transparent',
            color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Moon size={15} style={{ color: theme === 'dark' ? '#60a5fa' : 'inherit' }} />
          <span>ダーク</span>
        </button>
      </div>
    </section>
  );
}
