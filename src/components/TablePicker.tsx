import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { Callout } from './Callout';
import { useAccessibleTables, type AccessibleTablesService } from './useAccessibleTables';
import { TableComboBox } from './TableComboBox';

export interface TablePickerProps {
  value: string;
  onChange: (value: string) => void;
  metadataService: AccessibleTablesService;
  error?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onAccessibleTablesChange?: (tables: Set<string> | undefined) => void;
  customOnlyState?: readonly [boolean, (enabled: boolean) => void];
}

export function TablePicker({
  value,
  onChange,
  metadataService,
  error,
  disabled,
  ariaLabel = 'Table',
  onAccessibleTablesChange,
  customOnlyState,
}: TablePickerProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const {
    tables,
    loading,
    error: loadError,
    retry,
  } = useAccessibleTables(metadataService, onAccessibleTablesChange);
  const [localCustomOnly, setLocalCustomOnly] = useState(false);
  const customOnly = customOnlyState?.[0] ?? localCustomOnly;
  const setCustomOnly = customOnlyState?.[1] ?? setLocalCustomOnly;
  const loaded = !loading && loadError === undefined;
  const toggleCustomOnly = () => {
    const next = !customOnly;
    setCustomOnly(next);
    if (next && value && loaded &&
        !tables.some(table => table.logicalName === value && table.isCustomEntity === true)) {
      onChange('');
    }
  };
  const inaccessible = !loading && loadError === undefined && Boolean(value) &&
    !tables.some(table => table.logicalName === value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TableComboBox
        value={value}
        onChange={onChange}
        tables={tables}
        loading={loading}
        error={loadError}
        invalid={error}
        onRetry={retry}
        ariaLabel={ariaLabel}
        placeholder={loading ? 'Loading tables...' : 'Select a table…'}
        customOnly={customOnly}
        onCustomOnlyChange={toggleCustomOnly}
        filterDisabled={!loaded || disabled}
        disabled={!loaded || disabled}
      />
      {inaccessible && (
        <span role="status" aria-live="polite" style={{ color: T.accentAlt, fontFamily: T.font, fontSize: 11 }}>
          Saved table “{value}” is no longer accessible.
        </span>
      )}
      {loadError !== undefined && (
        <Callout type="err" icon="x">
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span>Could not load table list. {loadError}</span>
            <button
              type="button"
              onClick={retry}
              style={{
                flexShrink: 0,
                border: `1px solid ${T.error}`,
                background: T.pageBg,
                color: T.error,
                borderRadius: T.rS,
                fontFamily: T.font,
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </span>
        </Callout>
      )}
    </div>
  );
}
