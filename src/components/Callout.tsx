// src/components/Callout.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export type CalloutType = 'warn' | 'err' | 'ok' | 'info';

export interface CalloutProps {
  type?: CalloutType;
  icon?: string;
  children: React.ReactNode;
}

export function Callout({ type = 'warn', icon, children }: CalloutProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  const colors: Record<CalloutType, { bg: string; border: string; fg: string }> = {
    warn: { bg: T.warnBg,  border: T.warning, fg: T.warning },
    err:  { bg: T.errBg,   border: T.error,   fg: T.error   },
    ok:   { bg: T.okBg,    border: T.success,  fg: T.success },
    info: { bg: T.infoBg,  border: T.info,    fg: T.info    },
  };

  const c = colors[type] ?? colors.warn;

  return (
    <div style={{
      display: 'flex', gap: 8, padding: '8px 10px',
      background: c.bg, borderLeft: `3px solid ${c.border}`,
      borderRadius: T.rM, fontSize: 12, color: c.fg, lineHeight: 1.5,
    }}>
      {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
