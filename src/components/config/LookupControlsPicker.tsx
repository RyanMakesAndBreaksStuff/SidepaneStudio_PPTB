import * as React from 'react';
import { useEffect, useState } from 'react';
import type { LookupAttributeInfo, MetadataService } from '../../services/MetadataService';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../theme/tokens';
import { TableComboBox } from '../TableComboBox';

export interface LookupControlsPickerProps {
  entityName: string;
  value: string[];
  onChange: (next: string[]) => void;
  metadataService: Pick<MetadataService, 'listLookupAttributes'>;
  disabled?: boolean;
  error?: boolean;
}

type Load = { status: 'ok'; lookups: LookupAttributeInfo[] } | { status: 'error'; reason: string };

export function LookupControlsPicker({ entityName, value, onChange, metadataService, disabled, error }: LookupControlsPickerProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [result, setResult] = useState<Load | null>(null);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<{ service: typeof metadataService; entityName: string; retry: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (entityName) {
      metadataService.listLookupAttributes(entityName)
        .then(lookups => { if (!cancelled) { setResult({ status: 'ok', lookups }); setLoaded({ service: metadataService, entityName, retry }); } })
        .catch(err => { if (!cancelled) { setResult({ status: 'error', reason: err instanceof Error ? err.message : 'Could not load lookup controls.' }); setLoaded({ service: metadataService, entityName, retry }); } });
    }
    return () => { cancelled = true; };
  }, [entityName, metadataService, retry]);
  const current = loaded?.service === metadataService && loaded.entityName === entityName && loaded.retry === retry ? result : null;
  const lookups = current?.status === 'ok' ? current.lookups : [];
  const items = lookups.filter(lookup => !value.includes(lookup.LogicalName))
    .map(lookup => ({ logicalName: lookup.LogicalName, displayName: lookup.DisplayName?.UserLocalizedLabel?.Label?.trim() || lookup.LogicalName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  return (
    <div>
      <TableComboBox ariaLabel="Add lookup control" noun="lookup columns" items={items} value=""
        onChange={name => { if (name && !value.includes(name)) onChange([...value, name]); }}
        loading={!!entityName && !current} error={current?.status === 'error' ? current.reason : undefined}
        onRetry={() => setRetry(n => n + 1)} invalid={error}
        disabled={disabled || !entityName} placeholder={entityName ? 'Add lookup control…' : 'Select a table first'} />
      {!entityName && <div role="status">Select a table first</div>}
      {entityName && !current && <div role="status">Loading lookup columns…</div>}
      {current?.status === 'error' && <div role="alert">{current.reason} <button type="button" disabled={disabled} onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
      <ul aria-label="Selected lookup controls" style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6, padding: 0, margin: '8px 0 0' }}>
        {value.map(name => {
          const lookup = lookups.find(item => item.LogicalName === name);
          const label = lookup?.DisplayName?.UserLocalizedLabel?.Label?.trim() || name;
          return <li key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.stroke1}`, borderRadius: T.rS, padding: '2px 6px', color: T.fg1, fontFamily: T.font, fontSize: 12 }}>
            {label}{current?.status === 'ok' && !lookup ? ' (unavailable)' : ''}
            <button type="button" aria-label={`Remove ${name}`} disabled={disabled} onClick={() => onChange(value.filter(item => item !== name))}
              style={{ border: 0, background: 'transparent', color: T.fg3, cursor: disabled ? 'default' : 'pointer', fontFamily: T.font, padding: '0 2px' }}>×</button>
          </li>;
        })}
      </ul>
    </div>
  );
}
