import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { MetadataService } from '../services/MetadataService';
import { ValidationResult } from '../services/ValidationService';
import { TablePicker } from './TablePicker';
import { ViewPicker } from './ViewPicker';
import { NativeMdaFrame } from './NativeMdaFrame';
import { MockGrid } from './MockGrid';

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
  const configured = config.target.pageType === 'entitylist' && config.target.entityName.trim() === entityName ? config.target : undefined;
  const [selection, setSelection] = useState({ id: configured?.viewId ?? '', viewType: configured?.viewType ?? '' });
  return <div style={{ flex: 1, overflow: 'auto', padding: 12, minWidth: 0 }}>
    {allowEntityChange ? <label>Preview entity<TablePicker value={entityName} metadataService={metadataService} onChange={name => {
      setSelection({ id: '', viewType: '' });
      onEntityNameChange(name);
    }} /></label> : <p>Preview entity: {entityName}</p>}
    <ViewPicker entityName={entityName} value={selection.id} viewType={selection.viewType}
      metadataService={metadataService} onChange={view => setSelection({ id: view?.id ?? '', viewType: view?.viewType ?? '' })} />
    <GridData key={`${entityName}/${selection.viewType}/${selection.id}`} {...props} viewId={selection.id} viewType={selection.viewType} />
  </div>;
}

type State = { status: 'idle' | 'loading' } | { status: 'error'; reason: string } |
  { status: 'loaded'; rows: Record<string, unknown>[]; viewName: string };

function GridData({ config, validation, metadataService, entityName, viewId, viewType }: Props & {
  viewId: string; viewType: '' | 'savedquery' | 'userquery';
}): React.ReactElement {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const request = useRef(0);
  useEffect(() => {
    setState({ status: 'idle' });
    setSelectedRow(null);
    return () => { request.current += 1; };
  }, [metadataService]);
  const generate = async () => {
    const id = ++request.current;
    setSelectedRow(null);
    setState({ status: 'loading' });
    try {
      const result = await metadataService.listViewsForEntity(entityName);
      if (id !== request.current) return;
      if (result.status === 'error') throw new Error(result.reason);
      const view = result.views.find(item => item.id === viewId && item.viewType === viewType);
      if (!view) throw new Error('Select an accessible view.');
      const xml = capGridFetchXml(view.fetchXml, entityName);
      const response = await window.dataverseAPI.fetchXmlQuery(xml);
      if (id !== request.current) return;
      if (!Array.isArray(response.value) || response.value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
        throw new Error('The grid query returned an invalid response.');
      }
      setState({ status: 'loaded', rows: response.value.slice(0, 10), viewName: view.name });
    } catch (error) {
      if (id !== request.current) return;
      setState({ status: 'error', reason: error instanceof Error ? error.message : 'Could not load grid rows.' });
    }
  };
  return <>
    <p>Reads up to 10 rows from the selected view. Preview only.</p>
    <button type="button" disabled={!entityName || !viewId || !viewType || state.status === 'loading'} onClick={() => void generate()}>
      Generate grid preview
    </button>
    {state.status === 'loading' && <p role="status">Loading grid rows...</p>}
    {state.status === 'error' && <p role="alert">{state.reason}</p>}
    {state.status === 'loaded' && <NativeMdaFrame
      pane={{ ...config.pane, isSelected: selectedRow !== null }}
      hostTarget={{ pageType: 'entitylist', entityName, viewId, viewType }}
      paneTarget={config.target} validation={validation} caption={`${entityName} · ${state.viewName} · live data, simulated command`}>
      <MockGrid rows={state.rows} viewName={state.viewName} selectedRow={selectedRow} onCommand={setSelectedRow} />
    </NativeMdaFrame>}
  </>;
}