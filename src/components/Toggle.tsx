// src/components/Toggle.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface ToggleProps {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, desc, checked, onChange }: ToggleProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.fg1 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: T.fg3 }}>{desc}</div>}
      </div>
      <label
        role="switch"
        aria-checked={checked}
        style={{ cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
        />
        <div
          style={{
            width: 36, height: 18, borderRadius: 9,
            background: checked ? T.accentTeal : T.strokeAcc,
            position: 'relative', transition: 'background 200ms', cursor: 'pointer',
          }}
        >
          <div style={{
            position: 'absolute',
            left: checked ? 19 : 1, top: 1,
            width: 16, height: 16, borderRadius: '50%',
            background: 'white',
            transition: 'left 200ms cubic-bezier(.4,0,.2,1)',
            boxShadow: '0 1px 3px rgba(0,0,0,.25)',
          }} />
        </div>
      </label>
    </div>
  );
}
