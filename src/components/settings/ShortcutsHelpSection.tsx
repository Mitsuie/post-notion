import { Command, Info } from 'lucide-react';

interface ShortcutsHelpSectionProps {
  version?: string;
}

export function ShortcutsHelpSection({ version = 'v1.0.2' }: ShortcutsHelpSectionProps) {
  return (
    <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}
      >
        <Command size={14} style={{ color: 'var(--accent-primary)' }} />
        <span>キーボードショートカット</span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>投稿の即時送信</span>
          <kbd
            style={{
              background: 'var(--bg-tertiary)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              fontSize: '0.7rem',
            }}
          >
            Cmd / Ctrl + Enter
          </kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Markdown改行自動継続</span>
          <kbd
            style={{
              background: 'var(--bg-tertiary)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              fontSize: '0.7rem',
            }}
          >
            Enter
          </kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>階層インデント / アウトデント</span>
          <kbd
            style={{
              background: 'var(--bg-tertiary)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              fontSize: '0.7rem',
            }}
          >
            Tab / Shift + Tab
          </kbd>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          marginTop: '16px',
        }}
      >
        <Info size={12} />
        <span>post-notion {version} • Cloudflare Pages + Notion API</span>
      </div>
    </section>
  );
}
