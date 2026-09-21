import * as React from 'react';
import { useEffect, useState } from 'react';
import type { MetadataService, ViewInfo, ViewsForEntityResult } from '../services/MetadataService';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface ViewPickerProps {
  entityName: string;
  value: string;
  viewType: '' | 'savedquery' | 'userquery';
  onChange: (view: ViewInfo | null) => void;
  metadataService: Pick<MetadataService, 'listViewsForEntity'>;
  disabled?: boolean;
}

export function ViewPicker({ entityName, value, viewType, onChange, metadataService, disabled }: ViewPickerProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [result, setResult] = useState<ViewsForEntityResult | null>(null);
  const [loadedEntity, setLoadedEntity] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (entityName) {
      metadataService.listViewsForEntity(entityName).then(next => {
        if (!cancelled) { setResult(next); setLoadedEntity(entityName); }
      }).catch(error => {
        if (!cancelled) {
          setResult({ status: 'error', reason: error instanceof Error ? error.message : 'Could not load views.' });
          setLoadedEntity(entityName);
        }
      });
    }
    return () => { cancelled = true; };
  }, [entityName, metadataService, retry]);
  const current = loadedEntity === entityName ? result : null;
  const views = current?.status === 'ok' ? current.views : [];
  const key = value && viewType ? `${viewType}:${value}` : '';
  return (
    <div>
      <select aria-label="View" value={key} disabled={disabled || !entityName || !current || current.status === 'error'}
        style={{ width: '100%', color: T.fg1, background: T.surface1, border: `1px solid ${T.stroke1}`, padding: 8, borderRadius: T.rS }}
        onChange={event => onChange(views.find(view => `${view.viewType}:${view.id}` === event.target.value) ?? null)}>
        <option value="">{!entityName ? 'Select a table first' : !current ? 'Loading views…' : 'Default view'}</option>
        {key && !views.some(view => `${view.viewType}:${view.id}` === key) && <option value={key}>Configured view (unavailable)</option>}
        {views.map(view => <option key={`${view.viewType}:${view.id}`} value={`${view.viewType}:${view.id}`}>{view.name}{view.viewType === 'userquery' ? ' (personal)' : ''}</option>)}
      </select>
      {current?.status === 'error' && <div role="alert">{current.reason} <button type="button" disabled={disabled} onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
      {current?.status === 'ok' && views.length === 0 && <div>No views found. The default view will be used.</div>}
    </div>
  );
}