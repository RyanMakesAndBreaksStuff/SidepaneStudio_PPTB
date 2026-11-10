import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface StatusScreenAction {
  label: string;
  onClick: () => void;
}

export interface StatusScreenProps {
  /** Large leading glyph, for example "⚠". */
  icon?: string;
  title?: string;
  message?: string;
  role?: 'alert' | 'status';
  /** Primary button, drawn as an accent fill. */
  action?: StatusScreenAction;
  /** Secondary button, drawn as an outline. */
  secondaryAction?: StatusScreenAction;
}

/** Full-page loading and failure screen drawn from the theme. Use it only inside `ThemeProvider`. */
export function StatusScreen({ icon, title, message, role, action, secondaryAction }: StatusScreenProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const buttonBase: React.CSSProperties = {
    fontFamily: T.font, fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: T.rS, cursor: 'pointer',
  };
  return (
    <div role={role} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: 12, fontFamily: T.font, background: T.pageBg, color: T.fg1,
    }}>
      {icon && <div aria-hidden="true" style={{ fontSize: 32 }}>{icon}</div>}
      {title && <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>}
      {message && <div style={{ fontSize: 13, color: T.fg2, maxWidth: 360, textAlign: 'center' }}>{message}</div>}
      {action && (
        <button type="button" onClick={action.onClick}
          style={{ ...buttonBase, border: 'none', background: T.accent, color: T.accentFg }}>
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button type="button" onClick={secondaryAction.onClick}
          style={{ ...buttonBase, border: `1px solid ${T.strokeAcc}`, background: 'transparent', color: T.fg1 }}>
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
