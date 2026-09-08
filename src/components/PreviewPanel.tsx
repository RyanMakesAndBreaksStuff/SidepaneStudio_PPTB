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

export const PreviewPanel = React.memo(function PreviewPanel({
  config,
  validation,
  metadataService,
  xrm,
}: PreviewPanelProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [mode, setMode] = useState<PreviewMode>('mock');
  const gridEligible = config.target.pageType === 'entitylist' ||
    config.trigger.kind === 'MainGridButton' || config.trigger.kind === 'SubgridButton';
  useEffect(() => {
    if (!gridEligible && mode === 'grid') setMode('mock');
  }, [gridEligible, mode]);
  const [formState, setFormState] = useState<FormState>({ status: 'idle' });
  // Preview-local host entity. Independent of config.target.entityName so the
  // preview can mimic the pane sitting on a different table than the one the
  // pane itself targets. Initialized ONCE from the configured target (if any)
  // so the cold start isn't punitive — the user can resync on demand via the
  // FormSelector's "Use configured" affordance if config diverges later.
  const [previewHostEntity, setPreviewHostEntity] = useState<string>(
    () =>
      (config.target.pageType === 'entityrecord' || config.target.pageType === 'entitylist')
        ? config.target.entityName
        : ''
  );
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

  const configuredGridEntity = 'entityName' in config.target ? config.target.entityName.trim() : '';
  const gridEntity = configuredGridEntity || previewHostEntity;
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
          key={JSON.stringify([gridEntity, config.target, config.trigger.kind])}
          config={config} validation={validation} metadataService={metadataService}
          entityName={gridEntity} allowEntityChange={!configuredGridEntity} onEntityNameChange={setPreviewHostEntity}
        />}

        {/* Form mode */}
        {mode === 'form' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <FormSelector
              entityName={previewHostEntity}
              onEntityNameChange={setPreviewHostEntity}
              entityNameHint={
                (config.target.pageType === 'entityrecord' || config.target.pageType === 'entitylist')
                  ? config.target.entityName || undefined
                  : undefined
              }
              configuredEntity={
                (config.target.pageType === 'entityrecord' || config.target.pageType === 'entitylist')
                  ? config.target.entityName || undefined
                  : undefined
              }
              onUseConfigured={() => {
                if (
                  (config.target.pageType === 'entityrecord' || config.target.pageType === 'entitylist') &&
                  config.target.entityName
                ) {
                  setPreviewHostEntity(config.target.entityName);
                }
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

              {formState.status === 'loaded' && (
                <NativeMdaFrame
                  pane={config.pane}
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

function PreviewMeta({ config }: { config: PaneDefinitionConfig }): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const { mode } = usePreviewSize();
  const items: [string, string][] = useMemo(() => ([
    ['Width',  `${config.pane.width}px`],
    ['Header', config.pane.hideHeader ? 'Hidden' : 'Visible'],
    ['Close',  config.pane.canClose ? '✓' : '–'],
  ]), [config.pane.width, config.pane.hideHeader, config.pane.canClose]);

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
