// src/components/Input.tsx
import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface InputProps {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: boolean;
}

export function Input({ value, onChange, placeholder, type = 'text', disabled, error }: InputProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [focused, setFocused] = useState(false);

  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 30, padding: '0 9px',
        border: `1px solid ${error ? T.error : focused ? T.accent : T.strokeAcc}`,
        boxShadow: focused ? `0 0 0 1px ${error ? T.error : T.accent}` : 'none',
        borderRadius: T.rM,
        fontFamily: T.font, fontSize: 13, color: T.fg1,
        background: disabled ? T.surface3 : T.pageBg,
        width: '100%', outline: 'none',
        transition: 'border-color 80ms, box-shadow 80ms',
      }}
    />
  );
}
