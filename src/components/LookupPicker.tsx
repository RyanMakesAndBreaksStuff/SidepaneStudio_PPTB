import * as React from 'react';
import { useEffect, useState } from 'react';
import type { AttributeLabel, MetadataService } from '../services/MetadataService';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface LookupPickerProps {
  entityName: string;
  value: string;
  onChange: (logicalName: string) => void;
  metadataService: Pick<MetadataService, 'listLookupAttributes'>;
  disabled?: boolean;
  error?: boolean;
}

type LookupResult = { status: 'ok'; lookups: AttributeLabel[] } | { status: 'error'; reason: string };

function lookupLabel(lookup: AttributeLabel): string {
  const label = lookup.DisplayName?.UserLocalizedLabel?.Label?.trim();
  return label ? `${label} (${lookup.LogicalName})` : lookup.LogicalName;
}

/** Lookup columns on the RelatedRecord source table. Same load/retry lifecycle as ViewPicker. */
export function LookupPicker({ entityName, value, onChange, metadataService, disabled, error }: LookupPickerProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loadedEntity, setLoadedEntity] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (entityName) {
      metadataService.listLookupAttributes(entityName).then(lookups => {
        if (!cancelled) {
          setResult({ status: 'ok', lookups: [...lookups].sort((a, b) => lookupLabel(a).localeCompare(lookupLabel(b))) });
          setLoadedEntity(entityName);
        }
      }).catch(err => {
        if (!cancelled) {
          setResult({ status: 'error', reason: err instanceof Error ? err.message : 'Could not load lookup columns.' });
          setLoadedEntity(entityName);
        }
      });
    }
    return () => { cancelled = true; };
  }, [entityName, metadataService, retry]);
  const current = loadedEntity === entityName ? result : null;
  const lookups = current?.status === 'ok' ? current.lookups : [];
  return (
    <div>
      <select aria-label="Lookup column" value={value} disabled={disabled || !entityName || !current || current.status === 'error'}
        style={{ width: '100%', color: T.fg1, background: T.surface1, border: `1px solid ${error ? T.error : T.stroke1}`, padding: 8, borderRadius: T.rS }}
        onChange={event => onChange(event.target.value)}>
        <option value="">{!entityName ? 'Select a source table first' : !current ? 'Loading lookup columns…' : 'Select a lookup column'}</option>
        {value && !lookups.some(lookup => lookup.LogicalName === value) && <option value={value}>{value} (unavailable)</option>}
        {lookups.map(lookup => <option key={lookup.LogicalName} value={lookup.LogicalName}>{lookupLabel(lookup)}</option>)}
      </select>
      {current?.status === 'error' && <div role="alert">{current.reason} <button type="button" disabled={disabled} onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
      {current?.status === 'ok' && lookups.length === 0 && <div>This table has no lookup columns.</div>}
    </div>
  );
}
