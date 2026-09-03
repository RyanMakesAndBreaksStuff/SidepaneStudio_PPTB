// src/components/Select.tsx
import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  error?: boolean;
}

export function Select({ value, onChange, options, disabled, error }: SelectProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [focused, setFocused] = useState(false);

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 30, padding: '0 9px',
        border: `1px solid ${error ? T.error : focused ? T.accent : T.strokeAcc}`,
        boxShadow: focused ? `0 0 0 1px ${error ? T.error : T.accent}` : 'none',
        borderRadius: T.rM,
        fontFamily: T.font, fontSize: 13, color: T.fg1,
        background: disabled ? T.surface3 : T.pageBg, width: '100%', outline: 'none',
        transition: 'border-color 80ms, box-shadow 80ms',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
      ))}
    </select>
  );
}
