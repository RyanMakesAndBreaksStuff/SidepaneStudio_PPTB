import * as React from 'react';
import { useEffect, useRef } from 'react';
import type { MetadataService, ViewInfo } from '../services/MetadataService';
import { MetadataStatusMessage } from './MetadataStatusMessage';
import { TableComboBox } from './TableComboBox';
import { useMetadataRequest, type PickerStatus } from './useMetadataRequest';

export interface ViewPickerProps {
  entityName: string;
  value: string;
  viewType: '' | 'savedquery' | 'userquery';
  onChange: (view: ViewInfo | null) => void;
  metadataService: Pick<MetadataService, 'listViewsForEntity'>;
  disabled?: boolean;
  onStatusChange?: (status: PickerStatus) => void;
}

export function ViewPicker({ entityName, value, viewType, onChange, metadataService, disabled, onStatusChange }: ViewPickerProps): React.ReactElement {
  const request = useMetadataRequest(entityName ? async () => {
    const result = await metadataService.listViewsForEntity(entityName);
    if (result.status === 'error') throw new Error(result.reason);
    return result.views;
  } : null, [metadataService, entityName]);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const views = request.data ?? [];
  const key = value && viewType ? `${viewType}:${value}` : '';
  const selectedViewAvailable = !!key && views.some(view => `${view.viewType}:${view.id}` === key);
  const status: PickerStatus = request.status !== 'loaded' ? request.status
    : key ? selectedViewAvailable ? 'resolved' : 'unavailable'
      : views.length === 0 ? 'empty' : 'idle';
  useEffect(() => { onStatusChangeRef.current?.(status); }, [status]);
  return (
    <div>
      <TableComboBox ariaLabel="View" noun="views" value={key}
        items={views.map(view => ({ logicalName: `${view.viewType}:${view.id}`, displayName: view.name, detail: view.viewType === 'userquery' ? 'Personal view' : 'System view' }))}
        onChange={selected => onChange(views.find(view => `${view.viewType}:${view.id}` === selected) ?? null)}
        loading={request.status === 'loading'} error={request.error ?? undefined}
        onRetry={request.retry} invalid={!!key && !selectedViewAvailable}
        disabled={disabled || !entityName} placeholder={!entityName ? 'Select a table first' : 'Default view'} />
      <MetadataStatusMessage request={request} disabled={disabled} />
      {request.status === 'loaded' && views.length === 0 && <div>No views found. The default view will be used.</div>}
    </div>
  );
}
