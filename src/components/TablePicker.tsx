import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { Select, SelectOption } from './Select';
import { Callout } from './Callout';
import { CustomTableFilterButton } from './CustomTableFilterButton';
import { useAccessibleTables, type AccessibleTablesService } from './useAccessibleTables';

export interface TablePickerProps {
  value: string;
  onChange: (value: string) => void;
  metadataService: AccessibleTablesService;
  error?: boolean;
  disabled?: boolean;
  onAccessibleTablesChange?: (tables: Set<string> | undefined) => void;
  customOnlyState?: readonly [boolean, (enabled: boolean) => void];
}

export function TablePicker({
  value,
  onChange,
  metadataService,
  error,
  disabled,
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

  const options = useMemo<SelectOption[]>(() => {
    if (loading) return [{ value: value || '', label: 'Loading tables...' }];
    if (loadError !== undefined) return [{ value: value || '', label: 'Could not load table list' }];

    const visibleTables = customOnly
      ? tables.filter(table => table.isCustomEntity === true)
      : tables;
    const tableOptions = visibleTables.map(table => ({
      value: table.logicalName,
      label: `${table.displayName} (${table.logicalName})`,
    }));
    if (!customOnly && value && !tables.some(table => table.logicalName === value)) {
      return [{ value, label: `${value} (no longer accessible)`, disabled: true }, ...tableOptions];
    }
    if (tableOptions.length === 0) {
      return [{ value: '', label: customOnly ? 'No custom tables found' : 'No accessible tables found' }];
    }
    // Without an explicit placeholder, an unset value renders as whichever table is
    // alphabetically first (often "account") — selecting that table then does nothing,
    // since the <select> already displays it and fires no change event.
    return !value || (customOnly && !visibleTables.some(table => table.logicalName === value))
      ? [{ value: '', label: 'Select a table…' }, ...tableOptions]
      : tableOptions;
  }, [loading, loadError, tables, value, customOnly]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <CustomTableFilterButton
        pressed={customOnly}
        disabled={!loaded || disabled}
        onClick={toggleCustomOnly}
      />
      <Select
        value={customOnly && !options.some(option => option.value === value) ? '' : value}
        onChange={onChange}
        options={options}
        disabled={!loaded || disabled}
        error={error || loadError !== undefined}
      />
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
