import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface CommandBarProps {
  onReset: () => void;
}

export function CommandBar({ onReset }: CommandBarProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [hoverReset, setHoverReset] = useState(false);

  const handleReset = () => {
    if (!window.confirm('Reset all configuration? This cannot be undone.')) return;
    onReset();
  };

  return (
    <header
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        background: T.surface2,
        borderBottom: `1px solid ${T.stroke1}`,
        flexShrink: 0,
        gap: 10,
      }}
    >
      {/* Brand logo */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: T.rM,
          background: `linear-gradient(135deg, ${T.accentAlt} 0%, ${T.accent} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        S
      </div>

      <span style={{ fontWeight: 600, fontSize: 14, color: T.fg1, fontFamily: T.font }}>
        Side Pane Studio
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Reset button */}
        <button
          type="button"
          onClick={handleReset}
          onMouseEnter={() => setHoverReset(true)}
          onMouseLeave={() => setHoverReset(false)}
          style={{
            padding: '4px 12px',
            border: `1px solid ${T.stroke1}`,
            borderRadius: T.rS,
            background: hoverReset ? T.surface1 : 'transparent',
            color: T.fg2,
            fontFamily: T.font,
            fontSize: 12,
            cursor: 'pointer',
            transition: 'background 80ms',
          }}
        >
          ↺ Reset
        </button>
      </div>
    </header>
  );
}
