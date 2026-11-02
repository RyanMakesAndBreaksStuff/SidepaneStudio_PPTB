import * as React from 'react';
import { useEffect, useRef } from 'react';
import { displayLabel, type LookupAttributeInfo, type MetadataService } from '../services/MetadataService';
import { MetadataStatusMessage } from './MetadataStatusMessage';
import { TableComboBox } from './TableComboBox';
import { useMetadataRequest, type PickerStatus } from './useMetadataRequest';

export interface LookupPickerProps {
  entityName: string;
  value: string;
  onChange: (logicalName: string, selection?: LookupAttributeInfo) => void;
  onSelectionChange?: (lookup: LookupAttributeInfo | undefined) => void;
  onResolvedSelection?: (lookup: LookupAttributeInfo | undefined) => void;
  onStatusChange?: (status: PickerStatus, reason?: string) => void;
  metadataService: Pick<MetadataService, 'listLookupAttributes'>;
  disabled?: boolean;
  error?: boolean;
}

function lookupLabel(lookup: LookupAttributeInfo): string {
  const label = displayLabel(lookup);
  return label === lookup.LogicalName ? label : `${label} (${lookup.LogicalName})`;
}

/** Lookup columns on the RelatedRecord source table. Same load/retry lifecycle as ViewPicker. */
export function LookupPicker({ entityName, value, onChange, onSelectionChange, onResolvedSelection, onStatusChange, metadataService, disabled, error }: LookupPickerProps): React.ReactElement {
  const request = useMetadataRequest(
    entityName
      ? () => metadataService.listLookupAttributes(entityName)
        .then(lookups => [...lookups].sort((a, b) => lookupLabel(a).localeCompare(lookupLabel(b))))
      : null,
    [metadataService, entityName],
  );
  const onResolvedSelectionRef = useRef(onResolvedSelection);
  onResolvedSelectionRef.current = onResolvedSelection;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const lastResolutionRef = useRef<{ lookups: LookupAttributeInfo[]; entityName: string; value: string } | null>(null);
  const loaded = request.data;
  const lookups = loaded ?? [];
  const selectedLookup = lookups.find(lookup => lookup.LogicalName === value);
  const status: PickerStatus = request.status !== 'loaded' ? request.status
    : value && !selectedLookup ? 'unavailable'
      : lookups.length === 0 ? 'empty'
        : 'resolved';
  useEffect(() => {
    onStatusChangeRef.current?.(status, request.error ?? undefined);
  }, [status, request.error]);
  useEffect(() => {
    if (!loaded) return;
    const last = lastResolutionRef.current;
    if (last?.lookups === loaded && last.entityName === entityName && last.value === value) return;
    lastResolutionRef.current = { lookups: loaded, entityName, value };
    onResolvedSelectionRef.current?.(selectedLookup);
  }, [loaded, entityName, selectedLookup, value]);
  const targetSummary = selectedLookup?.Targets;
  return (
    <div>
      <TableComboBox ariaLabel="Lookup column" noun="lookup columns"
        items={lookups.map(lookup => ({ logicalName: lookup.LogicalName, displayName: lookupLabel(lookup) }))}
        value={value} onChange={logicalName => {
          const lookup = lookups.find(item => item.LogicalName === logicalName);
          onChange(logicalName, lookup);
          onSelectionChange?.(lookup);
        }} loading={request.status === 'loading'}
        error={request.error ?? undefined}
        onRetry={request.retry} invalid={error || (!!value && !selectedLookup)}
        disabled={disabled || !entityName}
        placeholder={!entityName ? 'Select a source table first' : 'Select a lookup column'} />
      <MetadataStatusMessage request={request} disabled={disabled}
        idleText="Select a source table to load lookup columns." loadingText="Loading lookup columns…"
        errorDetail="Lookup columns could not be checked, so the saved destination is unchanged." />
      {loaded && value && !selectedLookup && <div role="status">Saved lookup “{value}” is unavailable on this source table. Choose an available lookup before generating preview rows.</div>}
      {loaded && lookups.length === 0 && <div role="status">This table has no lookup columns.</div>}
      {selectedLookup && (!Array.isArray(targetSummary) || targetSummary.length === 0) &&
        <div role="status">Destination table information is unavailable.</div>}
      {selectedLookup && Array.isArray(targetSummary) && targetSummary.length === 1 &&
        <div role="status">Destination table: {targetSummary[0]}</div>}
      {selectedLookup && Array.isArray(targetSummary) && targetSummary.length > 1 &&
        <div role="status">Possible destination tables: {[...new Set(targetSummary)].join(', ')}. Determined by the selected row.</div>}
    </div>
  );
}
