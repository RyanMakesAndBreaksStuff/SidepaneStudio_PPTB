import * as React from 'react';
import { createContext, useContext, useId, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

/** Props that tie a form control to its Field's label, hint/error text and validity. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

const FieldControlContext = createContext<FieldControlProps | null>(null);

/** The enclosing Field's control props, for a control nested below it; empty outside a Field. */
export function useFieldControl(): Partial<FieldControlProps> {
  return useContext(FieldControlContext) ?? {};
}

export interface FieldProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** A render function receives the control props directly, for a raw element in the caller's own render. */
  children: React.ReactNode | ((control: FieldControlProps) => React.ReactNode);
}

export function Field({ label, required, hint, error, children }: FieldProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const control = useMemo<FieldControlProps>(() => ({
    id,
    'aria-describedby': error ? errorId : hint ? hintId : undefined,
    'aria-invalid': error ? true : undefined,
  }), [id, errorId, hintId, error, hint]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 12, fontWeight: 600, color: T.fg2 }}>
          {label}{required && <span style={{ color: T.error }}> *</span>}
        </label>
      )}
      <FieldControlContext.Provider value={control}>
        {typeof children === 'function' ? children(control) : children}
      </FieldControlContext.Provider>
      {error && <span id={errorId} style={{ fontSize: 11, color: T.error }}>{error}</span>}
      {!error && hint && <span id={hintId} style={{ fontSize: 11, color: T.accentAlt }}>{hint}</span>}
    </div>
  );
}
