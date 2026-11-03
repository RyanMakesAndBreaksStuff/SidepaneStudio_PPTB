// src/components/Toggle.tsx
import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface ToggleProps {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Keyboard focus only; a pointer press keeps the switch ring-free, like the platform's :focus-visible. */
function isFocusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

export function Toggle({ label, desc, checked, onChange }: ToggleProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [focusVisible, setFocusVisible] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.fg1 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: T.fg2 }}>{desc}</div>}
      </div>
      {/* A native button gives Tab focus and Space/Enter activation. */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        onFocus={event => setFocusVisible(isFocusVisible(event.currentTarget))}
        onBlur={() => setFocusVisible(false)}
        style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: 0,
          border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 11,
          outline: focusVisible ? `2px solid ${T.accent}` : 'none', outlineOffset: 2,
        }}
      >
        <span
          style={{
            display: 'block', width: 36, height: 18, borderRadius: 9,
            background: checked ? T.accent : T.strokeAcc,
            position: 'relative', transition: 'background 200ms',
          }}
        >
          <span style={{
            display: 'block', position: 'absolute',
            left: checked ? 19 : 1, top: 1,
            width: 16, height: 16, borderRadius: '50%',
            background: 'white',
            transition: 'left 200ms cubic-bezier(.4,0,.2,1)',
            boxShadow: '0 1px 3px rgba(0,0,0,.25)',
          }} />
        </span>
      </button>
    </div>
  );
}
