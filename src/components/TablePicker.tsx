import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { MetadataService, TableInfo } from '../services/MetadataService';
import { Select, SelectOption } from './Select';
import { Callout } from './Callout';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; tables: TableInfo[] }
  | { status: 'error'; reason: string };

export interface TablePickerProps {
  value: string;
  onChange: (value: string) => void;
  metadataService: Pick<MetadataService, 'listAccessibleTables' | 'invalidate'>;
  error?: boolean;
  disabled?: boolean;
  onAccessibleTablesChange?: (tables: Set<string> | undefined) => void;
}

export function TablePicker({
  value,
  onChange,
  metadataService,
  error,
  disabled,
  onAccessibleTablesChange,
}: TablePickerProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: 'loading' });
    onAccessibleTablesChange?.(undefined);

    metadataService.listAccessibleTables().then(result => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setLoadState({ status: 'loaded', tables: result.tables });
        onAccessibleTablesChange?.(new Set(result.tables.map(table => table.logicalName)));
      } else {
        setLoadState({ status: 'error', reason: result.reason });
        onAccessibleTablesChange?.(undefined);
      }
    }).catch(err => {
      if (cancelled) return;
      setLoadState({
        status: 'error',
        reason: err instanceof Error ? err.message : 'Unable to load table list.',
      });
      onAccessibleTablesChange?.(undefined);
    });

    return () => { cancelled = true; };
  }, [metadataService, onAccessibleTablesChange, reloadKey]);

  const retry = useCallback(() => {
    metadataService.invalidate();
    setReloadKey(key => key + 1);
  }, [metadataService]);

  const options = useMemo<SelectOption[]>(() => {
    if (loadState.status === 'loading') return [{ value: value || '', label: 'Loading tables...' }];
    if (loadState.status === 'error') return [{ value: value || '', label: 'Could not load table list' }];

    const tableOptions = loadState.tables.map(table => ({
      value: table.logicalName,
      label: `${table.displayName} (${table.logicalName})`,
    }));
    if (value && !loadState.tables.some(table => table.logicalName === value)) {
      return [{ value, label: `${value} (no longer accessible)`, disabled: true }, ...tableOptions];
    }
    return tableOptions.length > 0 ? tableOptions : [{ value: '', label: 'No accessible tables found' }];
  }, [loadState, value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        disabled={loadState.status !== 'loaded' || disabled}
        error={error || loadState.status === 'error'}
      />
      {loadState.status === 'error' && (
        <Callout type="err" icon="x">
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span>Could not load table list. {loadState.reason}</span>
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
