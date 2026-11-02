import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LookupAttributeInfo, MetadataService } from '../services/MetadataService';
import { TableComboBox } from './TableComboBox';

export interface LookupPickerProps {
  entityName: string;
  value: string;
  onChange: (logicalName: string, selection?: LookupAttributeInfo) => void;
  onSelectionChange?: (lookup: LookupAttributeInfo | undefined) => void;
  onResolvedSelection?: (lookup: LookupAttributeInfo | undefined) => void;
  onStatusChange?: (status: 'idle' | 'loading' | 'error' | 'unavailable' | 'empty' | 'resolved', reason?: string) => void;
  metadataService: Pick<MetadataService, 'listLookupAttributes'>;
  disabled?: boolean;
  error?: boolean;
}

type LookupResult = { status: 'ok'; lookups: LookupAttributeInfo[] } | { status: 'error'; reason: string };

function lookupLabel(lookup: LookupAttributeInfo): string {
  const label = lookup.DisplayName?.UserLocalizedLabel?.Label?.trim();
  return label ? `${label} (${lookup.LogicalName})` : lookup.LogicalName;
}

/** Lookup columns on the RelatedRecord source table. Same load/retry lifecycle as ViewPicker. */
export function LookupPicker({ entityName, value, onChange, onSelectionChange, onResolvedSelection, onStatusChange, metadataService, disabled, error }: LookupPickerProps): React.ReactElement {
  const [result, setResult] = useState<LookupResult | null>(null);
  const [retry, setRetry] = useState(0);
  const [loadedRequest, setLoadedRequest] = useState<{
    service: Pick<MetadataService, 'listLookupAttributes'>;
    entityName: string;
    retry: number;
  } | null>(null);
  const onResolvedSelectionRef = useRef(onResolvedSelection);
  onResolvedSelectionRef.current = onResolvedSelection;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const lastResolutionRef = useRef<{ result: LookupResult; entityName: string; value: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (entityName) {
      metadataService.listLookupAttributes(entityName).then(lookups => {
        if (!cancelled) {
          setResult({ status: 'ok', lookups: [...lookups].sort((a, b) => lookupLabel(a).localeCompare(lookupLabel(b))) });
          setLoadedRequest({ service: metadataService, entityName, retry });
        }
      }).catch(err => {
        if (!cancelled) {
          setResult({ status: 'error', reason: err instanceof Error ? err.message : 'Could not load lookup columns.' });
          setLoadedRequest({ service: metadataService, entityName, retry });
        }
      });
    }
    return () => { cancelled = true; };
  }, [entityName, metadataService, retry]);
  const isCurrentRequest = loadedRequest?.service === metadataService &&
    loadedRequest.entityName === entityName && loadedRequest.retry === retry;
  const current = isCurrentRequest ? result : null;
  const lookups = current?.status === 'ok' ? current.lookups : [];
  const selectedLookup = lookups.find(lookup => lookup.LogicalName === value);
  const status = !entityName ? 'idle'
    : !current ? 'loading'
      : current.status === 'error' ? 'error'
        : value && !selectedLookup ? 'unavailable'
          : lookups.length === 0 ? 'empty'
            : 'resolved';
  useEffect(() => {
    onStatusChangeRef.current?.(status, current?.status === 'error' ? current.reason : undefined);
  }, [current, status]);
  useEffect(() => {
    if (current?.status !== 'ok') return;
    const last = lastResolutionRef.current;
    if (last?.result === current && last.entityName === entityName && last.value === value) return;
    lastResolutionRef.current = { result: current, entityName, value };
    onResolvedSelectionRef.current?.(selectedLookup);
  }, [current, entityName, selectedLookup, value]);
  const targetSummary = selectedLookup?.Targets;
  return (
    <div>
      <TableComboBox ariaLabel="Lookup column" noun="lookup columns"
        items={lookups.map(lookup => ({ logicalName: lookup.LogicalName, displayName: lookupLabel(lookup) }))}
        value={value} onChange={logicalName => {
          const lookup = lookups.find(item => item.LogicalName === logicalName);
          onChange(logicalName, lookup);
          onSelectionChange?.(lookup);
        }} loading={!!entityName && !current}
        error={current?.status === 'error' ? current.reason : undefined}
        onRetry={() => setRetry(n => n + 1)} invalid={error || (!!value && !selectedLookup)}
        disabled={disabled || !entityName}
        placeholder={!entityName ? 'Select a source table first' : 'Select a lookup column'} />
      {!entityName && <div role="status" aria-live="polite">Select a source table to load lookup columns.</div>}
      {entityName && !current && <div role="status" aria-live="polite">Loading lookup columns…</div>}
      {current?.status === 'error' && <div role="alert">{current.reason} Lookup columns could not be checked, so the saved destination is unchanged. <button type="button" disabled={disabled} onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
      {current?.status === 'ok' && value && !selectedLookup && <div role="status">Saved lookup “{value}” is unavailable on this source table. Choose an available lookup before generating preview rows.</div>}
      {current?.status === 'ok' && lookups.length === 0 && <div role="status">This table has no lookup columns.</div>}
      {current?.status === 'ok' && selectedLookup && (!Array.isArray(targetSummary) || targetSummary.length === 0) &&
        <div role="status">Destination table information is unavailable.</div>}
      {current?.status === 'ok' && selectedLookup && Array.isArray(targetSummary) && targetSummary.length === 1 &&
        <div role="status">Destination table: {targetSummary[0]}</div>}
      {current?.status === 'ok' && selectedLookup && Array.isArray(targetSummary) && targetSummary.length > 1 &&
        <div role="status">Possible destination tables: {[...new Set(targetSummary)].join(', ')}. Determined by the selected row.</div>}
    </div>
  );
}
