export interface ToggleSwitchProps {
  checked: boolean;
  disabled?: boolean;
  activeColor: string;
  onChange: (checked: boolean) => void;
  title?: string;
  ariaLabel: string;
  theme: 'light' | 'dark';
}

/**
 * 視認性と操作性に優れたiOSスタイルの汎用トグルスイッチ
 */
export function ToggleSwitch({
  checked,
  disabled = false,
  activeColor,
  onChange,
  title,
  ariaLabel,
  theme,
}: ToggleSwitchProps) {
  const offTrackColor = theme === 'dark' ? '#334155' : '#cbd5e1';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      title={title}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        padding: 0,
        border: 'none',
        backgroundColor: checked && !disabled ? activeColor : offTrackColor,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background-color 0.2s ease, opacity 0.15s ease',
        outline: 'none',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: '2px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)',
          transform: checked && !disabled ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'block',
        }}
      />
    </button>
  );
}
