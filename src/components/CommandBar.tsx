import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface CommandBarProps {
  onReset: () => void;
}

export function CommandBar({ onReset }: CommandBarProps): React.ReactElement {
  const { isDark, setIsDark } = useTheme();
  const T = theme(isDark);
  const [hoverToggle, setHoverToggle] = useState(false);
  const [hoverReset, setHoverReset] = useState(false);

  const handleReset = () => {
    onReset();
    window.toolboxAPI?.utils?.showNotification({ title: 'Configuration reset', body: '', type: 'success' });
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
          background: `linear-gradient(135deg, ${T.accentOrange} 0%, ${T.accentTeal} 100%)`,
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

        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          onMouseEnter={() => setHoverToggle(true)}
          onMouseLeave={() => setHoverToggle(false)}
          style={{
            padding: '4px 10px',
            border: `1px solid ${T.stroke1}`,
            borderRadius: T.rS,
            background: hoverToggle ? T.surface1 : 'transparent',
            color: T.fg2,
            fontFamily: T.font,
            fontSize: 12,
            cursor: 'pointer',
            transition: 'background 80ms',
          }}
        >
          {isDark ? '☀ Light' : '🌙 Dark'}
        </button>
      </div>
    </header>
  );
}
