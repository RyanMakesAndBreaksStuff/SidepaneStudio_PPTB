import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { MetadataService, ViewInfo, ViewsForEntityResult } from '../services/MetadataService';
import { TableComboBox } from './TableComboBox';

export interface ViewPickerProps {
  entityName: string;
  value: string;
  viewType: '' | 'savedquery' | 'userquery';
  onChange: (view: ViewInfo | null) => void;
  metadataService: Pick<MetadataService, 'listViewsForEntity'>;
  disabled?: boolean;
  onStatusChange?: (status: 'idle' | 'loading' | 'error' | 'unavailable' | 'empty' | 'resolved') => void;
}

export function ViewPicker({ entityName, value, viewType, onChange, metadataService, disabled, onStatusChange }: ViewPickerProps): React.ReactElement {
  const [result, setResult] = useState<ViewsForEntityResult | null>(null);
  const [retry, setRetry] = useState(0);
  const [loadedRequest, setLoadedRequest] = useState<{
    service: Pick<MetadataService, 'listViewsForEntity'>;
    entityName: string;
    retry: number;
  } | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (entityName) {
      metadataService.listViewsForEntity(entityName).then(next => {
        if (!cancelled) { setResult(next); setLoadedRequest({ service: metadataService, entityName, retry }); }
      }).catch(error => {
        if (!cancelled) {
          setResult({ status: 'error', reason: error instanceof Error ? error.message : 'Could not load views.' });
          setLoadedRequest({ service: metadataService, entityName, retry });
        }
      });
    }
    return () => { cancelled = true; };
  }, [entityName, metadataService, retry]);
  const isCurrentRequest = loadedRequest?.service === metadataService &&
    loadedRequest.entityName === entityName && loadedRequest.retry === retry;
  const current = isCurrentRequest ? result : null;
  const views = current?.status === 'ok' ? current.views : [];
  const key = value && viewType ? `${viewType}:${value}` : '';
  const selectedViewAvailable = !!key && views.some(view => `${view.viewType}:${view.id}` === key);
  const status = !entityName ? 'idle'
    : !current ? 'loading'
      : current.status === 'error' ? 'error'
        : key ? selectedViewAvailable ? 'resolved' : 'unavailable'
          : views.length === 0 ? 'empty' : 'idle';
  useEffect(() => { onStatusChangeRef.current?.(status); }, [status, current]);
  return (
    <div>
      <TableComboBox ariaLabel="View" noun="views" value={key}
        items={views.map(view => ({ logicalName: `${view.viewType}:${view.id}`, displayName: view.name, detail: view.viewType === 'userquery' ? 'Personal view' : 'System view' }))}
        onChange={selected => onChange(views.find(view => `${view.viewType}:${view.id}` === selected) ?? null)}
        loading={!!entityName && !current} error={current?.status === 'error' ? current.reason : undefined}
        onRetry={() => setRetry(n => n + 1)} invalid={!!key && !selectedViewAvailable}
        disabled={disabled || !entityName} placeholder={!entityName ? 'Select a table first' : 'Default view'} />
      {current?.status === 'error' && <div role="alert">{current.reason} <button type="button" disabled={disabled} onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
      {current?.status === 'ok' && views.length === 0 && <div>No views found. The default view will be used.</div>}
    </div>
  );
}
