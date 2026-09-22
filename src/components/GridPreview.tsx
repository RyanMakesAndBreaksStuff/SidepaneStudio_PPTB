import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { MetadataService } from '../services/MetadataService';
import { ValidationResult } from '../services/ValidationService';
import { TablePicker } from './TablePicker';
import { ViewPicker } from './ViewPicker';
import { NativeMdaFrame } from './NativeMdaFrame';
import { MockGrid } from './MockGrid';
import type { GridColumn } from '../services/GridViewModel';
import { resolveGridColumns } from '../services/GridViewModel';
import { usePreviewSessionState } from '../contexts/PreviewSessionContext';

export function capGridFetchXml(source: string, entityName: string): string {
  const doc = new DOMParser().parseFromString(source, 'text/xml');
  const fetch = doc.documentElement;
  const entities = Array.from(fetch.children).filter(child => child.tagName === 'entity');
  if (doc.doctype || doc.querySelector('parsererror') || fetch.tagName !== 'fetch' ||
      entities.length !== 1 || entities[0].getAttribute('name') !== entityName) {
    throw new Error('This view does not contain valid FetchXML for the preview entity.');
  }
  const existing = fetch.getAttribute('top');
  if (existing !== null && (!/^\d+$/.test(existing) || Number(existing) < 1)) {
    throw new Error('This view has an invalid FetchXML row limit.');
  }
  for (const attribute of ['page', 'count', 'paging-cookie', 'returntotalrecordcount']) fetch.removeAttribute(attribute);
  fetch.setAttribute('top', String(Math.min(10, existing === null ? 10 : Number(existing))));
  return new XMLSerializer().serializeToString(doc);
}

interface Props {
  config: PaneDefinitionConfig;
  validation: ValidationResult;
  metadataService: MetadataService;
  entityName: string;
  allowEntityChange: boolean;
  onEntityNameChange: (name: string) => void;
}

export function GridPreview(props: Props): React.ReactElement {
  const { config, entityName, allowEntityChange, metadataService, onEntityNameChange } = props;
  const { isDark } = useTheme();
  const T = theme(isDark);
  const configured = config.target.pageType === 'entitylist' && config.target.entityName.trim() === entityName ? config.target : undefined;
  const selectionKey = JSON.stringify(['grid-view', entityName, configured?.viewId ?? '', configured?.viewType ?? '']);
  const [selection, setSelection] = usePreviewSessionState<{ id: string; viewType: '' | 'savedquery' | 'userquery' }>(
    selectionKey, { id: configured?.viewId ?? '', viewType: configured?.viewType ?? '' });
  return <div style={{ flex: 1, overflow: 'auto', padding: 12, minWidth: 0, color: T.fg1, fontFamily: T.font }}>
    {allowEntityChange ? <label style={{ color: T.fg2, fontFamily: T.font, fontSize: 12 }}>Preview entity<TablePicker value={entityName} metadataService={metadataService} onChange={onEntityNameChange} /></label> : <p style={{ color: T.fg2, fontFamily: T.font, fontSize: 12 }}>Preview entity: {entityName}</p>}
    <ViewPicker entityName={entityName} value={selection.id} viewType={selection.viewType}
      metadataService={metadataService} onChange={view => setSelection({ id: view?.id ?? '', viewType: view?.viewType ?? '' })} />
    <GridData key={JSON.stringify([entityName, selection.viewType, selection.id])} {...props} viewId={selection.id} viewType={selection.viewType} />
  </div>;
}

type State = { status: 'idle' | 'loading' } | { status: 'error'; reason: string } |
  { status: 'loaded'; rows: Record<string, unknown>[]; viewName: string; columns: GridColumn[] };

function GridData({ config, validation, metadataService, entityName, viewId, viewType }: Props & {
  viewId: string; viewType: '' | 'savedquery' | 'userquery';
}): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const dataKey = JSON.stringify(['grid-data', entityName, viewType, viewId]);
  const selectionKey = JSON.stringify(['grid-rows', entityName, viewType, viewId]);
  const [completed, setCompleted] = usePreviewSessionState<Extract<State, { status: 'loaded' }> | null>(dataKey, null);
  const [state, setState] = useState<State>(() => completed ?? { status: 'idle' });
  const [selectedRows, setSelectedRows] = usePreviewSessionState<number[]>(`${selectionKey}:checked`, []);
  const [activeRow, setActiveRow] = usePreviewSessionState<number | null>(`${selectionKey}:active`, null);
  const onSelectionChange = (indices: number[]) => {
    setSelectedRows(indices);
    const onSelect = config.trigger.kind === 'MainGridOnSelect' || config.trigger.kind === 'SubgridOnSelect';
    setActiveRow(onSelect && indices.length === 1 ? indices[0] : null);
  };
  const request = useRef(0);
  useEffect(() => {
    return () => { request.current += 1; };
  }, [metadataService]);
  const generate = async () => {
    const id = ++request.current;
    setCompleted(null);
    setSelectedRows([]);
    setActiveRow(null);
    setState({ status: 'loading' });
    try {
      const result = await metadataService.listViewsForEntity(entityName);
      if (id !== request.current) return;
      if (result.status === 'error') throw new Error(result.reason);
      const view = result.views.find(item => item.id === viewId && item.viewType === viewType);
      if (!view) throw new Error('Select an accessible view.');
      const xml = capGridFetchXml(view.fetchXml, entityName);
      const columns = await resolveGridColumns(view, entityName, metadataService);
      if (id !== request.current) return;
      const response = await window.dataverseAPI.fetchXmlQuery(xml);
      if (id !== request.current) return;
      if (!Array.isArray(response.value) || response.value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
        throw new Error('The grid query returned an invalid response.');
      }
      const loaded: Extract<State, { status: 'loaded' }> = {
        status: 'loaded', rows: response.value.slice(0, 10), viewName: view.name, columns,
      };
      setCompleted(loaded);
      setState(loaded);
    } catch (error) {
      if (id !== request.current) return;
      setState({ status: 'error', reason: error instanceof Error ? error.message : 'Could not load grid rows.' });
    }
  };
  return <>
    <p style={{ color: T.accent, fontFamily: T.font, fontSize: 12 }}>Reads up to 10 rows from the selected view. Preview only.</p>
    <button
      type="button"
      disabled={!entityName || !viewId || !viewType || state.status === 'loading'}
      onClick={() => void generate()}
      style={{
        border: `1px solid ${T.accent}`,
        borderRadius: T.rS,
        background: T.accentBg,
        color: T.accent,
        fontFamily: T.font,
        fontSize: 12,
        fontWeight: 600,
        padding: '6px 10px',
        cursor: 'pointer',
      }}
    >
      Generate grid preview
    </button>
    {state.status === 'loading' && <p role="status" style={{ color: T.fg3, fontFamily: T.font, fontSize: 12 }}>Loading grid rows...</p>}
    {state.status === 'error' && <p role="alert" style={{ color: T.error, fontFamily: T.font, fontSize: 12 }}>{state.reason}</p>}
    {state.status === 'loaded' && <NativeMdaFrame
      pane={{ ...config.pane, isSelected: activeRow !== null }}
      hostTarget={{ pageType: 'entitylist', entityName, viewId, viewType }}
      paneTarget={config.target} validation={validation} caption={`${entityName} · ${state.viewName} · live data, simulated command`}>
      <MockGrid rows={state.rows} columns={state.columns} viewName={state.viewName}
        selectedRows={selectedRows} activeRow={activeRow} onSelectionChange={onSelectionChange}
        onCommand={() => { if (selectedRows.length === 1) setActiveRow(selectedRows[0]); }}
        onRefresh={() => void generate()} />
    </NativeMdaFrame>}
  </>;
}
