import * as React from 'react';
import { useEffect, useState } from 'react';
import type { AttributeLabel, MetadataService } from '../../services/MetadataService';
import { TableComboBox } from '../TableComboBox';

export interface ColumnPickerProps {
  entityName: string;
  value: string;
  onChange: (logicalName: string) => void;
  metadataService: Pick<MetadataService, 'listAttributeLabels'>;
  disabled?: boolean;
  error?: boolean;
}

type Load = { status: 'ok'; columns: AttributeLabel[] } | { status: 'error'; reason: string };

export function columnLabel(column: AttributeLabel): string {
  return column.DisplayName?.UserLocalizedLabel?.Label?.trim() || column.LogicalName;
}

export function ColumnPicker({ entityName, value, onChange, metadataService, disabled, error }: ColumnPickerProps): React.ReactElement {
  const [result, setResult] = useState<Load | null>(null);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<{ service: typeof metadataService; entityName: string; retry: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (entityName) {
      metadataService.listAttributeLabels(entityName)
        .then(columns => { if (!cancelled) { setResult({ status: 'ok', columns }); setLoaded({ service: metadataService, entityName, retry }); } })
        .catch(err => { if (!cancelled) { setResult({ status: 'error', reason: err instanceof Error ? err.message : 'Could not load columns.' }); setLoaded({ service: metadataService, entityName, retry }); } });
    }
    return () => { cancelled = true; };
  }, [entityName, metadataService, retry]);
  const current = loaded?.service === metadataService && loaded.entityName === entityName && loaded.retry === retry ? result : null;
  const items = current?.status === 'ok'
    ? current.columns.map(c => ({ logicalName: c.LogicalName, displayName: columnLabel(c) })).sort((a, b) => a.displayName.localeCompare(b.displayName))
    : [];
  const unavailable = current?.status === 'ok' && !!value && !items.some(i => i.logicalName === value);
  return (
    <div>
      <TableComboBox ariaLabel="Column" noun="columns" items={items} value={value} onChange={onChange}
        loading={!!entityName && !current} error={current?.status === 'error' ? current.reason : undefined}
        onRetry={() => setRetry(n => n + 1)} invalid={error || unavailable}
        disabled={disabled || !entityName} placeholder={entityName ? undefined : 'Select a table first'} />
      {!entityName && <div role="status">Select a table first</div>}
      {entityName && !current && <div role="status">Loading columns…</div>}
      {current?.status === 'error' && <div role="alert">{current.reason} <button type="button" disabled={disabled} onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
      {unavailable && <div role="status">Saved column “{value}” is unavailable on this table.</div>}
    </div>
  );
}
