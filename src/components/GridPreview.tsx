import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import { MetadataService } from '../services/MetadataService';
import type { ViewInfo } from '../services/MetadataService';
import { ValidationResult } from '../services/ValidationService';
import { TablePicker } from './TablePicker';
import { ViewPicker } from './ViewPicker';
import { LookupPicker } from './LookupPicker';
import { NativeMdaFrame } from './NativeMdaFrame';
import { MockGrid } from './MockGrid';
import type { GridColumn } from '../services/GridViewModel';
import { getRelatedLookup, resolveGridColumns, resolveRelatedRecord } from '../services/GridViewModel';
import { usePreviewSessionState } from '../contexts/PreviewSessionContext';
import { applyRelatedLookup, changeRelatedSource } from '../services/relatedRecordConfig';
import type { LookupAttributeInfo } from '../services/MetadataService';
import { isValidLogicalName } from '../services/odataGuards';

export function capGridFetchXml(source: string, entityName: string, lookupAttribute = ''): string {
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
  // RelatedRecord previews read the lookup value even when the view does not display it.
  if (lookupAttribute && !Array.from(entities[0].children).some(child => child.tagName === 'all-attributes' ||
      (child.tagName === 'attribute' && child.getAttribute('name') === lookupAttribute))) {
    const column = doc.createElement('attribute');
    column.setAttribute('name', lookupAttribute);
    entities[0].appendChild(column);
  }
  for (const attribute of ['page', 'count', 'paging-cookie', 'returntotalrecordcount']) fetch.removeAttribute(attribute);
  fetch.setAttribute('top', String(Math.min(10, existing === null ? 10 : Number(existing))));
  return new XMLSerializer().serializeToString(doc);
}

interface Props {
  config: PaneDefinitionConfig;
  validation: ValidationResult;
  metadataService: MetadataService;
  xrm: Pick<IXrmContext, 'fetchXml'>;
  entityName: string;
  allowEntityChange: boolean;
  onEntityNameChange: (name: string) => void;
  onConfigChange?: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
}

export function GridPreview(props: Props): React.ReactElement {
  const { config, entityName, allowEntityChange, metadataService, onEntityNameChange, onConfigChange } = props;
  const { isDark } = useTheme();
  const T = theme(isDark);
  const relatedMode = config.context.mode === 'RelatedRecord';
  const relatedLookup = getRelatedLookup(config);
  const configured = !relatedMode && config.target.pageType === 'entitylist' && config.target.entityName.trim() === entityName ? config.target : undefined;
  type ViewSelection = { id: string; viewType: '' | 'savedquery' | 'userquery' };
  const [relatedView, setRelatedView] = usePreviewSessionState<{ entityName: string; selection: ViewSelection }>(
    'related-grid-view', { entityName, selection: { id: '', viewType: '' } });
  const [regularSelection, setRegularSelection] = usePreviewSessionState<ViewSelection>(
    JSON.stringify(['grid-view', entityName, configured?.viewId ?? '', configured?.viewType ?? '']),
    { id: configured?.viewId ?? '', viewType: configured?.viewType ?? '' });
  const emptySelection: ViewSelection = { id: '', viewType: '' };
  const selection: ViewSelection = relatedMode
    ? (relatedView.entityName === entityName ? relatedView.selection : emptySelection)
    : regularSelection;
  const setSelection = relatedMode
    ? (next: ViewSelection) => setRelatedView({ entityName, selection: next })
    : setRegularSelection;
  const [relatedGeneration, setRelatedGeneration] = usePreviewSessionState<number>('related-grid-generation', 0);
  const [resolvedLookupIdentity, setResolvedLookupIdentity] = usePreviewSessionState<{
    service: MetadataService;
    identity: string;
  } | null>('related-grid-lookup-identity', null);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'error' | 'unavailable' | 'empty' | 'resolved'>('idle');
  const [resolvedLookup, setResolvedLookup] = useState<{ entityName: string; lookup: LookupAttributeInfo } | null>(null);
  const [viewStatus, setViewStatus] = useState<'idle' | 'loading' | 'error' | 'unavailable' | 'empty' | 'resolved'>('idle');
  const [relatedContext, setRelatedContext] = usePreviewSessionState<{ key: string; generation: number }>(
    'related-grid-context', { key: '', generation: 0 });
  const dependencyKey = JSON.stringify([entityName, relatedLookup]);
  const generationFloor = Math.max(relatedGeneration, relatedContext.generation);
  const effectiveGeneration = relatedMode && relatedContext.key !== dependencyKey
    ? generationFloor + 1 : relatedGeneration;
  useEffect(() => {
    if (!relatedMode || relatedContext.key === dependencyKey) return;
    setRelatedContext({ key: dependencyKey, generation: effectiveGeneration });
    setRelatedGeneration(effectiveGeneration);
    if (relatedView.entityName !== entityName) setRelatedView({ entityName, selection: { id: '', viewType: '' } });
  }, [relatedMode, relatedContext.key, dependencyKey, effectiveGeneration, relatedView.entityName,
    entityName, setRelatedContext, setRelatedGeneration, setRelatedView]);
  const customOnlyState = usePreviewSessionState<boolean>('grid-custom-tables-only', false);
  const resetRelatedPreview = () => setRelatedGeneration(value => value + 1);
  const changeSource = (source: string) => {
    if (relatedMode) {
      setResolvedLookup(null);
      setResolvedLookupIdentity(null);
      setRelatedView({ entityName: source, selection: { id: '', viewType: '' } });
      resetRelatedPreview();
      onConfigChange?.(prev => changeRelatedSource(prev, source));
    } else onEntityNameChange(source);
  };
  const changeLookup = (lookup: LookupAttributeInfo | undefined, userSelected = false) => {
    if (!relatedMode) return;
    setResolvedLookup(lookup ? { entityName, lookup } : null);
    if (!lookup) return;
    const targets = [...new Set((Array.isArray(lookup.Targets) ? lookup.Targets : [])
      .filter((target): target is string => typeof target === 'string' && isValidLogicalName(target)))].sort();
    const identity = JSON.stringify([entityName, lookup.LogicalName, targets]);
    const identityChanged = resolvedLookupIdentity !== null &&
      (resolvedLookupIdentity.service !== metadataService || resolvedLookupIdentity.identity !== identity);
    setResolvedLookupIdentity({ service: metadataService, identity });
    if (userSelected || identityChanged) resetRelatedPreview();
    onConfigChange?.(prev => applyRelatedLookup(prev, entityName, lookup));
  };
  const clearLookup = () => {
    if (!relatedMode) return;
    setResolvedLookup(null);
    setResolvedLookupIdentity(null);
    resetRelatedPreview();
    onConfigChange?.(prev => applyRelatedLookup(prev, entityName, null));
  };
  const changeView = (view: ViewSelection) => {
    setSelection(view);
    if (relatedMode) resetRelatedPreview();
  };
  const toViewSelection = (view: ViewInfo | null): ViewSelection => ({
    id: view?.id ?? '',
    viewType: view?.viewType === 'savedquery' || view?.viewType === 'userquery' ? view.viewType : '',
  });
  return <div style={{ flex: 1, overflow: 'auto', padding: 12, minWidth: 0, color: T.fg1, fontFamily: T.font }}>
    {relatedMode ? <div role="group" aria-label="Related record source"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10, color: T.fg2, fontFamily: T.font, fontSize: 12 }}>
      <div style={{ gridColumn: '1 / -1', fontWeight: 600 }}>Related record source — changes update configuration</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Source table
        <TablePicker ariaLabel="Source table" value={entityName} metadataService={metadataService}
          onChange={changeSource} customOnlyState={customOnlyState} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Related record lookup
        <LookupPicker entityName={entityName} value={relatedLookup} metadataService={metadataService}
          onChange={(logicalName, lookup) => lookup ? changeLookup(lookup, true) : !logicalName && clearLookup()}
          onResolvedSelection={changeLookup} onStatusChange={status => setLookupStatus(status)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Source view
        <ViewPicker entityName={entityName} value={selection.id} viewType={selection.viewType}
          metadataService={metadataService} onChange={view => changeView(toViewSelection(view))}
          onStatusChange={status => setViewStatus(status)} />
      </label>
    </div> : allowEntityChange ? (
      <div role="group" aria-label="Preview entity"
        style={{ color: T.fg2, fontFamily: T.font, fontSize: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Preview entity
        <TablePicker ariaLabel="Preview entity" value={entityName} metadataService={metadataService}
          onChange={changeSource} customOnlyState={customOnlyState} />
        </label>
      </div>
    ) : <p style={{ color: T.fg2, fontFamily: T.font, fontSize: 12 }}>Preview entity: {entityName}</p>}
    {!relatedMode && <ViewPicker entityName={entityName} value={selection.id} viewType={selection.viewType}
      metadataService={metadataService} onChange={view => changeView(toViewSelection(view))} />}
    <GridData key={JSON.stringify([entityName, selection.viewType, selection.id, relatedLookup, effectiveGeneration])} {...props}
      viewId={selection.id} viewType={selection.viewType} relatedLookup={relatedLookup}
      relatedTargets={resolvedLookup?.entityName === entityName && resolvedLookup.lookup.LogicalName === relatedLookup
        ? resolvedLookup.lookup.Targets : undefined}
      relatedGeneration={relatedMode ? effectiveGeneration : 0}
      relatedReady={!relatedMode || (lookupStatus === 'resolved' && !!relatedLookup && viewStatus === 'resolved')} />
  </div>;
}

type State = { status: 'idle' | 'loading' } | { status: 'error'; reason: string } |
  { status: 'loaded'; rows: Record<string, unknown>[]; viewName: string; columns: GridColumn[] };

function GridData({ config, validation, metadataService, xrm, entityName, viewId, viewType, relatedLookup,
  relatedTargets, relatedGeneration, relatedReady }: Props & {
  viewId: string; viewType: '' | 'savedquery' | 'userquery'; relatedLookup: string;
  relatedTargets?: string[] | null;
  relatedGeneration: number; relatedReady: boolean;
}): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const dataKey = JSON.stringify(['grid-data', entityName, viewType, viewId, relatedLookup, relatedGeneration]);
  const selectionKey = JSON.stringify(['grid-rows', entityName, viewType, viewId, relatedLookup, relatedGeneration]);
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
  }, [metadataService, xrm]);
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
      const xml = capGridFetchXml(view.fetchXml, entityName, relatedLookup);
      const columns = await resolveGridColumns(view, entityName, metadataService);
      if (id !== request.current) return;
      const response = await xrm.fetchXml(xml);
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
  // RelatedRecord: the pane opens the selected row's lookup record and stays closed when the lookup is empty.
  const relatedResolution = relatedLookup !== '' && activeRow !== null && state.status === 'loaded'
    ? resolveRelatedRecord(state.rows[activeRow], relatedLookup, relatedTargets) : null;
  const related = relatedResolution?.status === 'resolved' ? relatedResolution.record : null;
  const paneOpen = activeRow !== null && (relatedLookup === '' || relatedResolution?.status === 'resolved');
  return <>
    <p style={{ color: T.accent, fontFamily: T.font, fontSize: 12 }}>Reads up to 10 rows from the selected view. Preview only.</p>
    <button
      type="button"
      disabled={!entityName || !viewId || !viewType || state.status === 'loading' || !relatedReady}
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
    {relatedResolution?.status === 'empty' && activeRow !== null && <p role="status" style={{ color: T.fg3, fontFamily: T.font, fontSize: 12 }}>
      No {relatedLookup} value on row {activeRow + 1}, so the pane does not open.
    </p>}
    {relatedResolution?.status === 'unresolved' && relatedResolution.reason === 'table-unknown' &&
      <p role="status" style={{ color: T.fg3, fontFamily: T.font, fontSize: 12 }}>The related record's table could not be determined.</p>}
    {relatedResolution?.status === 'unresolved' && relatedResolution.reason === 'table-not-allowed' &&
      <p role="alert" style={{ color: T.error, fontFamily: T.font, fontSize: 12 }}>The lookup annotation identifies a table that is not an allowed destination table.</p>}
    {state.status === 'loaded' && <NativeMdaFrame
      pane={{ ...config.pane, isSelected: paneOpen }}
      hostTarget={{ pageType: 'entitylist', entityName, viewId, viewType }} paneRecord={related ?? undefined}
      paneTarget={config.target} validation={validation} caption={`${entityName} · ${state.viewName} · live data, simulated command`}>
      <MockGrid rows={state.rows} columns={state.columns} viewName={state.viewName}
        selectedRows={selectedRows} activeRow={activeRow} onSelectionChange={onSelectionChange}
        onCommand={() => { if (selectedRows.length === 1) setActiveRow(selectedRows[0]); }}
        onRefresh={() => void generate()} />
    </NativeMdaFrame>}
  </>;
}
