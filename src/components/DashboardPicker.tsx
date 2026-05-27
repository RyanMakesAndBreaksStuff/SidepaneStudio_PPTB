import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { MetadataService, DashboardInfo, AccessibleDashboardsResult } from '../services/MetadataService';
import { Select, SelectOption } from './Select';
import { Callout } from './Callout';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; dashboards: DashboardInfo[] }
  | { status: 'error'; reason: string };

export interface DashboardPickerProps {
  value: string;
  onChange: (id: string, name: string) => void;
  metadataService: Pick<MetadataService, 'listAccessibleDashboards' | 'invalidate'>;
  error?: boolean;
  disabled?: boolean;
}

export function DashboardPicker({
  value,
  onChange,
  metadataService,
  error,
  disabled,
}: DashboardPickerProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: 'loading' });
    metadataService.listAccessibleDashboards().then((result: AccessibleDashboardsResult) => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setLoadState({ status: 'loaded', dashboards: result.dashboards });
      } else {
        setLoadState({ status: 'error', reason: result.reason });
      }
    }).catch((err: unknown) => {
      if (cancelled) return;
      setLoadState({
        status: 'error',
        reason: err instanceof Error ? err.message : 'Unable to load dashboards.',
      });
    });
    return () => { cancelled = true; };
  }, [metadataService, reloadKey]);

  const retry = useCallback(() => {
    metadataService.invalidate();
    setReloadKey(k => k + 1);
  }, [metadataService]);

  const options = useMemo<SelectOption[]>(() => {
    if (loadState.status === 'loading') return [{ value: value || '', label: 'Loading dashboards...' }];
    if (loadState.status === 'error') return [{ value: value || '', label: 'Could not load dashboards' }];
    const opts = loadState.dashboards.map(d => ({
      value: d.id,
      label: d.isPersonal ? `${d.name} (Personal)` : d.name,
    }));
    if (value && !loadState.dashboards.some(d => d.id === value)) {
      return [{ value, label: `${value} (no longer accessible)`, disabled: true }, ...opts];
    }
    return opts.length > 0 ? opts : [{ value: '', label: 'No dashboards found' }];
  }, [loadState, value]);

  const handleChange = useCallback((id: string) => {
    if (loadState.status !== 'loaded') return;
    const found = loadState.dashboards.find(d => d.id === id);
    if (found) onChange(found.id, found.name);
  }, [loadState, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Select
        value={value}
        onChange={handleChange}
        options={options}
        disabled={loadState.status !== 'loaded' || disabled}
        error={error || loadState.status === 'error'}
      />
      {loadState.status === 'error' && (
        <Callout type="err" icon="x">
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span>Could not load dashboards. {loadState.reason}</span>
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
