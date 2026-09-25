import * as React from 'react';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { IXrmContext } from '../adapters/PptbContextAdapter';
import { ValidationResult } from '../services/ValidationService';
import { FormXmlService, FormModel } from '../services/FormXmlService';
import { MetadataService } from '../services/MetadataService';
import { FormSelector, FormSelection } from './FormSelector';
import { FormXmlRenderer } from './FormXmlRenderer';
import { GridPreview } from './GridPreview';
import { MockMDAShell } from './MockMDAShell';
import { NativeMdaFrame } from './NativeMdaFrame';
import { PreviewSizeProvider, usePreviewSize } from './previewSize';
import { PreviewSessionBoundary, usePreviewSessionState } from '../contexts/PreviewSessionContext';
import { buildRelatedSampleFetchXml, getRelatedLookup, relatedRecordOf } from '../services/GridViewModel';
import type { PreviewRecord } from '../services/GridViewModel';

export interface PreviewPanelProps {
  config: PaneDefinitionConfig;
  validation: ValidationResult;
  /**
   * Shared MetadataService — the cache is the same one Configure's TablePicker
   * uses, so the preview entity dropdown reuses the already-fetched table list.
   */
  metadataService: MetadataService;
  xrm: IXrmContext;
}

type PreviewMode = 'mock' | 'form' | 'grid';

type FormState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; reason: string }
  | { status: 'loaded'; model: FormModel };

type SampleState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; reason: string }
  | { status: 'loaded'; record: PreviewRecord | null };

/** Table the preview host form or grid shows: the RelatedRecord source table, else the table the pane targets. */
function getConfiguredHostEntity(config: PaneDefinitionConfig): string {
  if (config.context.mode === 'RelatedRecord') return config.context.entityName.trim();
  return config.target.pageType === 'entityrecord' || config.target.pageType === 'entitylist'
    ? config.target.entityName.trim()
    : '';
}

const PreviewPanelContent = React.memo(function PreviewPanelContent({
  config,
  validation,
  metadataService,
  xrm,
}: PreviewPanelProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [mode, setMode] = usePreviewSessionState<PreviewMode>('preview-mode', 'mock');
  const gridEligible = config.target.pageType === 'entitylist' ||
    config.trigger.kind === 'MainGridButton' || config.trigger.kind === 'SubgridButton' ||
    config.trigger.kind === 'MainGridOnSelect' || config.trigger.kind === 'SubgridOnSelect';
  useEffect(() => {
    if (!gridEligible && mode === 'grid') setMode('mock');
  }, [gridEligible, mode]);
  const [formState, setFormState] = useState<FormState>({ status: 'idle' });
  // Preview-local host entity. Independent of the configured host table so the
  // preview can mimic the pane sitting on a different table than the one the
  // pane itself targets. Initialized ONCE from the configured host table (if any)
  // so the cold start isn't punitive — the user can resync on demand via the
  // FormSelector's "Use configured" affordance if config diverges later.
  const configuredHostEntity = getConfiguredHostEntity(config);
  const [previewHostEntity, setPreviewHostEntity] = usePreviewSessionState<string>(
    'preview-host-entity',
    () => configuredHostEntity
  );
  // RelatedRecord Form preview: one sample source record supplies the lookup the pane opens.
  // Keyed by host table + lookup so changing either discards the previous sample.
  const relatedLookup = getRelatedLookup(config);
  const showSample = relatedLookup !== '' && previewHostEntity === configuredHostEntity;
  const sampleKey = JSON.stringify([previewHostEntity, relatedLookup]);
  const [sample, setSample] = useState<{ key: string; state: SampleState }>({ key: '', state: { status: 'idle' } });
  const sampleState: SampleState = sample.key === sampleKey ? sample.state : { status: 'idle' };
  const sampleRequestRef = useRef(0);
  const formRequestIdRef = useRef(0);
  const mountedRef = useRef(true);

  // Container-query: observe our own width and broadcast a layout mode to children.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setContainerWidth(prev => (Math.abs(prev - w) < 0.5 ? prev : w));
      }
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const formXmlSvcRef = useRef<FormXmlService | null>(null);
  if (!formXmlSvcRef.current) formXmlSvcRef.current = new FormXmlService(xrm);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      formRequestIdRef.current += 1;
    };
  }, []);

  const handleFormSelected = useCallback(async (selection: FormSelection | null) => {
    const requestId = formRequestIdRef.current + 1;
    formRequestIdRef.current = requestId;

    if (!selection) {
      setFormState({ status: 'idle' });
      return;
    }
    setFormState({ status: 'loading' });
    const result = await formXmlSvcRef.current!.getFormModelResult(selection.formId);
    if (!mountedRef.current || formRequestIdRef.current !== requestId) return;

    if (!result.ok) {
      setFormState({ status: 'error', reason: 'Could not load form layout. Check your connection.' });
    } else {
      setFormState({ status: 'loaded', model: result.model });
    }
  }, []);

  const loadSample = async () => {
    const requestId = ++sampleRequestRef.current;
    setSample({ key: sampleKey, state: { status: 'loading' } });
    try {
      const response = await window.dataverseAPI.fetchXmlQuery(buildRelatedSampleFetchXml(previewHostEntity, relatedLookup));
      if (!mountedRef.current || sampleRequestRef.current !== requestId) return;
      const row = Array.isArray(response.value) ? response.value[0] : undefined;
      setSample({ key: sampleKey, state: { status: 'loaded',
        record: row && typeof row === 'object' ? relatedRecordOf(row, relatedLookup) : null } });
    } catch (error) {
      if (!mountedRef.current || sampleRequestRef.current !== requestId) return;
      setSample({ key: sampleKey, state: { status: 'error',
        reason: error instanceof Error ? error.message : 'Could not load a sample record.' } });
    }
  };

  const gridEntity = configuredHostEntity || previewHostEntity;
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    border: 'none',
    borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
    background: 'transparent',
    color: active ? T.accent : T.fg3,
    fontFamily: T.font,
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  });

  return (
    <div
      ref={rootRef}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.pageBg, minWidth: 0 }}
    >
      <PreviewSizeProvider width={containerWidth}>
        {/* Mode tab strip */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.stroke1}`, background: T.surface2, flexShrink: 0 }}>
          <button style={tabStyle(mode === 'mock')} onClick={() => setMode('mock')}>Mock</button>
          <button style={tabStyle(mode === 'form')} onClick={() => setMode('form')}>Form</button>
          {gridEligible && <button style={tabStyle(mode === 'grid')} onClick={() => setMode('grid')}>Grid</button>}
        </div>

        {/* Mock mode */}
        {mode === 'mock' && (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              padding: 12,
              gap: 12,
              minWidth: 0,
            }}
          >
            <MockMDAShell pane={config.pane} target={config.target} validation={validation} />
            <PreviewMeta config={config} />
          </div>
        )}

        {/* Grid mode */}
        {mode === 'grid' && gridEligible && <GridPreview
          key={JSON.stringify([gridEntity,
            config.target.pageType === 'entitylist' ? config.target.viewId : '',
            config.target.pageType === 'entitylist' ? config.target.viewType : ''])}
          config={config} validation={validation} metadataService={metadataService}
          entityName={gridEntity} allowEntityChange={!configuredHostEntity} onEntityNameChange={setPreviewHostEntity}
        />}

        {/* Form mode */}
        {mode === 'form' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <FormSelector
              entityName={previewHostEntity}
              onEntityNameChange={setPreviewHostEntity}
              entityNameHint={configuredHostEntity || undefined}
              configuredEntity={configuredHostEntity || undefined}
              onUseConfigured={() => {
                if (configuredHostEntity) setPreviewHostEntity(configuredHostEntity);
              }}
              formXmlService={formXmlSvcRef.current}
              metadataService={metadataService}
              onFormSelected={handleFormSelected}
            />

            <div
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: 12,
                minWidth: 0,
              }}
            >
              {formState.status === 'idle' && (
                <MockMDAShell pane={config.pane} target={config.target} validation={validation} />
              )}

              {formState.status === 'loading' && (
                <div style={{ color: T.fg3, fontFamily: T.font, fontSize: 13, textAlign: 'center', padding: 24 }}>
                  Loading form layout…
                </div>
              )}

              {formState.status === 'error' && (
                <div style={{ color: T.error, fontFamily: T.font, fontSize: 13, textAlign: 'center', padding: 24 }}>
                  {formState.reason}
                </div>
              )}

              {formState.status === 'loaded' && showSample && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8, fontFamily: T.font, fontSize: 12 }}>
                  <button type="button" disabled={sampleState.status === 'loading'} onClick={() => void loadSample()}
                    style={{ border: `1px solid ${T.accent}`, borderRadius: T.rS, background: T.accentBg, color: T.accent,
                      fontFamily: T.font, fontSize: 12, fontWeight: 600, padding: '6px 10px', cursor: 'pointer' }}>
                    Load sample {previewHostEntity} record
                  </button>
                  {sampleState.status === 'loading' && <span role="status" style={{ color: T.fg3 }}>Loading sample record...</span>}
                  {sampleState.status === 'error' && <span role="alert" style={{ color: T.error }}>{sampleState.reason}</span>}
                  {sampleState.status === 'loaded' && sampleState.record === null && <span role="status" style={{ color: T.fg3 }}>
                    No {previewHostEntity} record has a {relatedLookup} value, so the pane does not open.
                  </span>}
                </div>
              )}

              {formState.status === 'loaded' && (
                <NativeMdaFrame
                  pane={sampleState.status === 'loaded' ? { ...config.pane, isSelected: sampleState.record !== null } : config.pane}
                  paneRecord={sampleState.status === 'loaded' ? sampleState.record ?? undefined : undefined}
                  hostTarget={{
                    pageType: 'entityrecord',
                    entityName: previewHostEntity,
                    formId: '', tabName: '', data: '',
                  }}
                  paneTarget={config.target}
                  validation={validation}
                  formModel={formState.model}
                >
                  <FormXmlRenderer model={formState.model} />
                </NativeMdaFrame>
              )}
            </div>
          </div>
        )}
      </PreviewSizeProvider>
    </div>
  );
});

export const PreviewPanel = React.memo(function PreviewPanel(props: PreviewPanelProps): React.ReactElement {
  return <PreviewSessionBoundary><PreviewPanelContent {...props} /></PreviewSessionBoundary>;
});

function PreviewMeta({ config }: { config: PaneDefinitionConfig }): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const { mode } = usePreviewSize();
  const items: [string, string][] = useMemo(() => {
    const rows: [string, string][] = [
      ['Width', `${config.pane.width}px`],
      ['Header', config.pane.hideHeader ? 'Hidden' : 'Visible'],
      ['Close', config.pane.canClose ? '✓' : '–'],
    ];
    const target = config.target;
    if (target.pageType === 'entitylist' && target.viewId) rows.push(['View', target.viewId]);
    if (target.pageType === 'entityrecord' && target.formId) rows.push(['Form', target.formId]);
    if (target.pageType === 'entityrecord' && target.tabName.trim()) rows.push(['Tab', target.tabName.trim()]);
    return rows;
  }, [config.pane.width, config.pane.hideHeader, config.pane.canClose, config.target]);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        rowGap: 4,
        columnGap: mode === 'compact' ? 12 : 16,
        fontSize: 11,
        color: T.fg3,
        fontFamily: T.font,
        justifyContent: mode === 'compact' ? 'flex-start' : 'center',
      }}
    >
      {items.map(([label, val]) => (
        <span key={label}>{label}: <strong style={{ color: T.fg1 }}>{val}</strong></span>
      ))}
    </div>
  );
}
