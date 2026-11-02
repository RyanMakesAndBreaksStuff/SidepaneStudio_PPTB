import * as React from 'react';
import { displayLabel, type MetadataService } from '../../services/MetadataService';
import { MetadataStatusMessage } from '../MetadataStatusMessage';
import { TableComboBox } from '../TableComboBox';
import { useMetadataRequest } from '../useMetadataRequest';

export interface ColumnPickerProps {
  entityName: string;
  value: string;
  onChange: (logicalName: string) => void;
  metadataService: Pick<MetadataService, 'listAttributeLabels'>;
  disabled?: boolean;
  error?: boolean;
}

export function ColumnPicker({ entityName, value, onChange, metadataService, disabled, error }: ColumnPickerProps): React.ReactElement {
  const request = useMetadataRequest(
    entityName ? () => metadataService.listAttributeLabels(entityName) : null,
    [metadataService, entityName],
  );
  const items = (request.data ?? [])
    .map(c => ({ logicalName: c.LogicalName, displayName: displayLabel(c) }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const unavailable = request.status === 'loaded' && !!value && !items.some(i => i.logicalName === value);
  return (
    <div>
      <TableComboBox ariaLabel="Column" noun="columns" items={items} value={value} onChange={onChange}
        loading={request.status === 'loading'} error={request.error ?? undefined}
        onRetry={request.retry} invalid={error || unavailable}
        disabled={disabled || !entityName} placeholder={entityName ? undefined : 'Select a table first'} />
      <MetadataStatusMessage request={request} disabled={disabled} idleText="Select a table first" loadingText="Loading columns…" />
      {unavailable && <div role="status">Saved column “{value}” is unavailable on this table.</div>}
    </div>
  );
}
