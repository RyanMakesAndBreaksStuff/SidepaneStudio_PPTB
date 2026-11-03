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
import { capGridFetchXml, getRelatedLookup, parseGridFetch, resolveGridColumns, resolveRelatedRecord } from '../services/GridViewModel';
import { usePreviewPane, usePreviewSessionState } from '../contexts/PreviewSessionContext';
import { applyLookup, changeHostTable } from '../services/relatedRecordConfig';
import type { LookupAttributeInfo } from '../services/MetadataService';
import { isValidLogicalName } from '../services/odataGuards';

interface Props {
  config: PaneDefinitionConfig;
  validation: ValidationResult;
  metadataService: MetadataService;
  xrm: Pick<IXrmContext, 'fetchXml'>;
  onConfigChange?: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
}

export function GridPreview(props: Props): React.ReactElement {
  const { config, metadataService, onConfigChange } = props;
  const entityName = config.host.entityName;
  const { isDark } = useTheme();
  const T = theme(isDark);
  const relatedMode = config.context.source.kind === 'lookup';
  const relatedLookup = getRelatedLookup(config);
  type ViewSelection = { id: string; viewType: '' | 'savedquery' | 'userquery' };
  const selection: ViewSelection = { id: config.host.viewId, viewType: config.host.viewType };
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
  }, [relatedMode, relatedContext.key, dependencyKey, effectiveGeneration,
    setRelatedContext, setRelatedGeneration]);
  const customOnlyState = usePreviewSessionState<boolean>('grid-custom-tables-only', false);
  const resetRelatedPreview = () => setRelatedGeneration(value => value + 1);
  const changeSource = (source: string) => {
    setResolvedLookup(null);
    setResolvedLookupIdentity(null);
    resetRelatedPreview();
    onConfigChange?.(prev => changeHostTable(prev, source));
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
    onConfigChange?.(prev => applyLookup(prev, entityName, lookup));
  };
  const clearLookup = () => {
    if (!relatedMode) return;
    setResolvedLookup(null);
    setResolvedLookupIdentity(null);
    resetRelatedPreview();
    onConfigChange?.(prev => applyLookup(prev, entityName, null));
  };
  const changeView = (view: ViewSelection) => {
    onConfigChange?.(prev => ({ ...prev, host: { ...prev.host, viewId: view.id, viewType: view.viewType } }));
    if (relatedMode) resetRelatedPreview();
  };
  const toViewSelection = (view: ViewInfo | null): ViewSelection => ({
    id: view?.id ?? '',
    viewType: view?.viewType === 'savedquery' || view?.viewType === 'userquery' ? view.viewType : '',
  });
  return <div style={{ flex: 1, overflow: 'auto', padding: 12, minWidth: 0, color: T.fg1, fontFamily: T.font }}>
    <div role="group" aria-label="Grid source"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10, color: T.fg2, fontFamily: T.font, fontSize: 12 }}>
      <div style={{ gridColumn: '1 / -1', fontWeight: 600 }}>Grid source — changes update configuration</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Source table
        <TablePicker ariaLabel="Source table" value={entityName} metadataService={metadataService}
          onChange={changeSource} customOnlyState={customOnlyState} />
      </label>
      {relatedMode && <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Lookup column
        <LookupPicker entityName={entityName} value={relatedLookup} metadataService={metadataService}
          onChange={(logicalName, lookup) => lookup ? changeLookup(lookup, true) : !logicalName && clearLookup()}
          onResolvedSelection={changeLookup} onStatusChange={status => setLookupStatus(status)} />
      </label>}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>View
        <ViewPicker entityName={entityName} value={selection.id} viewType={selection.viewType}
          metadataService={metadataService} onChange={view => changeView(toViewSelection(view))}
          onStatusChange={status => setViewStatus(status)} />
      </label>
    </div>
    <GridData key={JSON.stringify([entityName, selection.viewType, selection.id, relatedLookup, effectiveGeneration])} {...props}
      entityName={entityName} viewId={selection.id} viewType={selection.viewType} relatedLookup={relatedLookup}
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
  entityName: string; viewId: string; viewType: '' | 'savedquery' | 'userquery'; relatedLookup: string;
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
  const [paneSession, openPane] = usePreviewPane('grid');
  // RelatedRecord: the pane opens the row's lookup record and stays closed when the lookup is empty.
  const resolveRow = (index: number) => relatedLookup !== '' && state.status === 'loaded'
    ? resolveRelatedRecord(state.rows[index], relatedLookup, relatedTargets) : null;
  /** Each command or row selection is one invocation of the generated script. */
  const invoke = (index: number | null) => {
    setActiveRow(index);
    if (index !== null && (relatedLookup === '' || resolveRow(index)?.status === 'resolved')) {
      openPane(config.pane.isSelected, config.behavior.reuseExistingPane);
    }
  };
  const onSelectionChange = (indices: number[]) => {
    setSelectedRows(indices);
    const onSelect = config.trigger.kind === 'GridRowSelect';
    invoke(onSelect && indices.length === 1 ? indices[0] : null);
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
      const parsed = parseGridFetch(view.fetchXml, entityName);
      const xml = capGridFetchXml(parsed, relatedLookup);
      const columns = await resolveGridColumns(view, entityName, metadataService, parsed);
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
  const relatedResolution = activeRow !== null ? resolveRow(activeRow) : null;
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
      pane={{ ...config.pane, isSelected: paneOpen && paneSession.selected }} paneTarget={config.target} validation={validation}
      variant={{ kind: 'grid', caption: `${entityName} · ${state.viewName} · live data, simulated command`, record: related }}>
      <MockGrid rows={state.rows} columns={state.columns} viewName={state.viewName}
        selectedRows={selectedRows} activeRow={activeRow} onSelectionChange={onSelectionChange}
        onCommand={() => { if (selectedRows.length === 1) invoke(selectedRows[0]); }}
        onRefresh={() => void generate()} />
    </NativeMdaFrame>}
  </>;
}
