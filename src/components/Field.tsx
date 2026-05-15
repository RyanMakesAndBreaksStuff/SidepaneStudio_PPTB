// src/components/Field.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface FieldProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, required, hint, error, children }: FieldProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: T.fg2 }}>
          {label}{required && <span style={{ color: T.error }}> *</span>}
        </label>
      )}
      {children}
      {error && <span style={{ fontSize: 11, color: T.error }}>{error}</span>}
      {!error && hint && <span style={{ fontSize: 11, color: T.fg3 }}>{hint}</span>}
    </div>
  );
}
