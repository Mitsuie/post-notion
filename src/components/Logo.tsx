interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const iconSize = size === 'sm' ? 26 : size === 'lg' ? 42 : 32;
  const fontSize = size === 'sm' ? '1.15rem' : size === 'lg' ? '1.5rem' : '1.35rem';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      {/* テーマに応じたアプリアイコン表示（ライト: icon_light.png / ダーク: icon_dark.png） */}
      <img
        src="/icon_light.png"
        alt="Post-Notion Logo"
        width={iconSize}
        height={iconSize}
        className="logo-img-light"
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          objectFit: 'contain',
          flexShrink: 0,
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08))',
        }}
      />
      <img
        src="/icon_dark.png"
        alt="Post-Notion Logo"
        width={iconSize}
        height={iconSize}
        className="logo-img-dark"
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          objectFit: 'contain',
          flexShrink: 0,
          filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))',
        }}
      />

      {/* タイトルワードマーク（提案2: メカニカル・モノスペース） */}
      {showText && (
        <span
          style={{
            fontSize,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '-0.02em',
            display: 'inline-flex',
            alignItems: 'baseline',
            lineHeight: 1,
          }}
        >
          <span style={{ color: 'var(--logo-post)', fontWeight: 700 }}>Post</span>
          <span style={{ color: 'var(--logo-sep)', margin: '0 2px', fontWeight: 500 }}>-</span>
          <span style={{ color: 'var(--logo-notion)', fontWeight: 800 }}>Notion</span>
        </span>
      )}
    </div>
  );
}
