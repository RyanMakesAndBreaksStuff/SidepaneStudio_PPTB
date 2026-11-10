import * as React from 'react';
import type { LookupAttributeInfo } from '../services/MetadataService';
import { MetadataStatusMessage } from './MetadataStatusMessage';
import { TableComboBox } from './TableComboBox';
import { lookupLabel, type LookupColumns } from './useLookupColumns';

export interface LookupPickerProps {
  /** The loaded lookup columns of `entityName`, owned by the caller (see `useLookupColumns`). */
  columns: LookupColumns;
  entityName: string;
  value: string;
  onChange: (logicalName: string, selection?: LookupAttributeInfo) => void;
  disabled?: boolean;
  error?: boolean;
  /** Render the resolved destination table(s) under the picker. Off where the surrounding form already states them. */
  showDestination?: boolean;
}

/** Lookup columns on the RelatedRecord source table. Presentational: the caller fetches, resolves and reacts. */
export function LookupPicker({ columns, entityName, value, onChange, disabled, error, showDestination = true }: LookupPickerProps): React.ReactElement {
  const { request, loaded } = columns;
  const lookups = loaded ?? [];
  const selectedLookup = columns.find(value);
  const targetSummary = selectedLookup?.Targets;
  return (
    <div>
      <TableComboBox ariaLabel="Lookup column" noun="lookup columns"
        items={lookups.map(lookup => ({ logicalName: lookup.LogicalName, displayName: lookupLabel(lookup) }))}
        value={value} onChange={logicalName => onChange(logicalName, columns.find(logicalName))}
        loading={request.status === 'loading'}
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
        <div role="status">The “{selectedLookup.LogicalName}” lookup has no related tables, so there is no record to open. Choose a different lookup column.</div>}
      {showDestination && selectedLookup && Array.isArray(targetSummary) && targetSummary.length === 1 &&
        <div role="status">Destination table: {targetSummary[0]}</div>}
      {showDestination && selectedLookup && Array.isArray(targetSummary) && targetSummary.length > 1 &&
        <div role="status">Possible destination tables: {[...new Set(targetSummary)].join(', ')}. Determined by the selected row.</div>}
    </div>
  );
}
