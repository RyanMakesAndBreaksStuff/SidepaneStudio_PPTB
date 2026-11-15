import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface RetryButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/** The themed Retry control shared by every metadata load-failure message. */
export function RetryButton({ onClick, disabled }: RetryButtonProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const tone = disabled ? T.fg3 : T.error;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        flexShrink: 0,
        border: `1px solid ${tone}`,
        background: T.pageBg,
        color: tone,
        borderRadius: T.rS,
        fontFamily: T.font,
        fontSize: 12,
        fontWeight: 600,
        padding: '2px 8px',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      Retry
    </button>
  );
}
