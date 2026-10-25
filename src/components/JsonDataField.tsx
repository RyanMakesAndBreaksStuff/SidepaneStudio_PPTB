// src/components/JsonDataField.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { Field } from './Field';

export interface JsonDataFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Extra guidance under the textarea. */
  children?: React.ReactNode;
}

/** JSON-object textarea shared by Table record form data and Generative page data. */
export function JsonDataField({ label, hint, value, onChange, error, placeholder, disabled, children }: JsonDataFieldProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  return (
    <Field label={label} hint={hint} error={error}>
      <textarea aria-label={label} value={value} disabled={disabled} rows={4} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', color: T.fg1, background: T.surface1, border: `1px solid ${T.stroke1}`, borderRadius: T.rS, fontFamily: T.mono, fontSize: 12 }}
        onChange={event => onChange(event.target.value)} />
      {children}
    </Field>
  );
}
