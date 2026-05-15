// src/components/Section.tsx
import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface SectionProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Section({ title, icon, defaultOpen = true, children }: SectionProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: `1px solid ${T.stroke1}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', textAlign: 'left', border: 'none',
          background: 'transparent', padding: '9px 14px',
          fontFamily: T.font, fontSize: 13, fontWeight: 600,
          color: T.fg1, cursor: 'pointer',
          transition: 'background 80ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = T.surface1; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
        {title}
        <span style={{
          marginLeft: 'auto', color: T.fg3, fontSize: 11,
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 180ms cubic-bezier(.4,0,.2,1)',
          display: 'inline-block',
        }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}
