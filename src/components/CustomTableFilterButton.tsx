import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

interface Props {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function CustomTableFilterButton({ pressed, disabled, onClick }: Props): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  return <button
    type="button"
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
    title="Hide standard tables; show them again by turning this off"
    style={{
      alignSelf: 'flex-start',
      border: '1px solid ' + (pressed ? T.accent : T.stroke1),
      background: pressed ? T.accentBg : T.surface1,
      color: pressed ? T.accent : T.fg2,
      borderRadius: T.rS,
      fontFamily: T.font,
      fontSize: 12,
      padding: '4px 8px',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }}
  >Hide standard tables</button>;
}
