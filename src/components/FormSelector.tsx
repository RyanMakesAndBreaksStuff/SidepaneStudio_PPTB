import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { FormXmlService, FormMeta } from '../services/FormXmlService';
import { MetadataService, TableInfo } from '../services/MetadataService';
import { TableComboBox } from './TableComboBox';

export interface FormSelection {
  entityLogicalName: string;
  formId: string;
}

export interface FormSelectorProps {
  /**
   * The entity to load forms for. PREVIEW-LOCAL — owned by the host component
   * (PreviewPanel), independent from the configured pane target. Pass empty
   * string for "not picked yet".
   */
  entityName: string;
  onEntityNameChange: (next: string) => void;
  /** Optional placeholder shown in the entity input (e.g. the configured pane target). */
  entityNameHint?: string;
  /**
   * The configured pane target entity, surfaced for the "Use configured"
   * re-sync affordance + divergence indicator. Independence is preserved —
   * the field never auto-syncs; the user re-syncs on demand.
   */
  configuredEntity?: string;
  /** Invoked when the user clicks the "Use configured" link. */
  onUseConfigured?: () => void;
  formXmlService: FormXmlService;
  /**
   * Metadata service — same instance used by Configure's TablePicker. The cache
   * inside MetadataService is shared across both consumers, so the table list
   * is fetched once per session (5-min TTL) regardless of which picker hits it first.
   */
  metadataService: Pick<MetadataService, 'listAccessibleTables' | 'invalidate'>;
  onFormSelected: (selection: FormSelection | null) => void;
}

export function FormSelector({
  entityName,
  onEntityNameChange,
  entityNameHint,
  configuredEntity,
  onUseConfigured,
  formXmlService,
  metadataService,
  onFormSelected,
}: FormSelectorProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [forms, setForms] = useState<FormMeta[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const requestIdRef = useRef(0);
  const onFormSelectedRef = useRef(onFormSelected);
  onFormSelectedRef.current = onFormSelected;

  // Table list state — mirrors TablePicker's loading shape so the combobox
  // can show loading / error / loaded states. Cache is per-MetadataService
  // instance, so the second consumer just gets the cached array back.
  type TablesState =
    | { status: 'loading' }
    | { status: 'loaded'; tables: TableInfo[] }
    | { status: 'error'; reason: string };
  const [tablesState, setTablesState] = useState<TablesState>({ status: 'loading' });
  const [tablesReloadKey, setTablesReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setTablesState({ status: 'loading' });
    metadataService.listAccessibleTables().then(result => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setTablesState({ status: 'loaded', tables: result.tables });
      } else {
        setTablesState({ status: 'error', reason: result.reason });
      }
    }).catch(err => {
      if (cancelled) return;
      setTablesState({
        status: 'error',
        reason: err instanceof Error ? err.message : 'Unable to load table list.',
      });
    });
    return () => { cancelled = true; };
  }, [metadataService, tablesReloadKey]);

  const retryTables = useCallback(() => {
    metadataService.invalidate();
    setTablesReloadKey(k => k + 1);
  }, [metadataService]);

  const commitEntity = (next: string) => {
    const trimmed = next.trim();
    if (trimmed !== entityName) onEntityNameChange(trimmed);
  };

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!entityName) {
      setForms([]);
      setSelectedFormId('');
      setLoading(false);
      setError('');
      onFormSelectedRef.current(null);
      return;
    }

    setLoading(true);
    setError('');
    setSelectedFormId('');
    onFormSelectedRef.current(null);

    formXmlService.getFormsForEntityResult(entityName).then(result => {
      if (requestIdRef.current !== requestId) return;

      if (!result.ok) {
        setForms([]);
        setLoading(false);
        setError('Could not load main forms.');
        return;
      }

      setForms(result.forms);
      setLoading(false);
      if (result.forms.length === 1) {
        setSelectedFormId(result.forms[0].id);
        onFormSelectedRef.current({ entityLogicalName: entityName, formId: result.forms[0].id });
      }
    }).catch(() => {
      if (requestIdRef.current !== requestId) return;
      setForms([]);
      setLoading(false);
      setError('Could not load main forms.');
    });
  }, [entityName, formXmlService, retryCount]);

  const handleFormChange = (formId: string) => {
    setSelectedFormId(formId);
    if (formId) {
      onFormSelected({ entityLogicalName: entityName, formId });
    } else {
      onFormSelected(null);
    }
  };

  const labelStyle = useMemo(() => ({
    fontSize: 11,
    color: T.fg3,
    fontFamily: T.font,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: 2,
  } as React.CSSProperties), [T]);

  const fieldStyle = useMemo(() => ({
    width: '100%',
    padding: '4px 8px',
    border: `1px solid ${T.stroke1}`,
    borderRadius: T.rS,
    background: T.surface1,
    color: T.fg1,
    fontFamily: T.font,
    fontSize: 13,
    boxSizing: 'border-box',
  } as React.CSSProperties), [T]);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
        padding: '8px 12px',
        background: T.surface2,
        borderBottom: `1px solid ${T.stroke1}`,
        minWidth: 0,
      }}
    >
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
          <div style={{ ...labelStyle, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Preview Entity</span>
            {configuredEntity && entityName && configuredEntity !== entityName && (
              <span
                title={`Preview is showing a different entity than the configured pane target (${configuredEntity}).`}
                style={{
                  fontFamily: T.mono,
                  fontSize: 9,
                  fontWeight: 600,
                  color: T.warning,
                  padding: '1px 5px',
                  border: `1px solid ${T.warning}`,
                  borderRadius: 999,
                  letterSpacing: '.4px',
                  textTransform: 'uppercase',
                }}
              >
                diverged
              </span>
            )}
          </div>
          {configuredEntity && configuredEntity !== entityName && onUseConfigured && (
            <button
              type="button"
              onClick={onUseConfigured}
              title={`Set preview entity to ${configuredEntity}`}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                margin: 0,
                color: T.accentTeal,
                fontFamily: T.font,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                textTransform: 'none',
                letterSpacing: 0,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8a5 5 0 0 1 8.5-3.5L13 6" />
                <path d="M13 3v3h-3" />
                <path d="M13 8a5 5 0 0 1-8.5 3.5L3 10" />
                <path d="M3 13v-3h3" />
              </svg>
              Use {configuredEntity}
            </button>
          )}
        </div>
        <TableComboBox
          value={entityName}
          onChange={commitEntity}
          tables={tablesState.status === 'loaded' ? tablesState.tables : []}
          loading={tablesState.status === 'loading'}
          error={tablesState.status === 'error' ? tablesState.reason : undefined}
          onRetry={retryTables}
          placeholder={entityNameHint ? `e.g. ${entityNameHint}` : 'Select a table…'}
          ariaLabel="Preview entity"
        />
      </div>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={labelStyle}>Form</div>
        {loading ? (
          <div style={{ ...fieldStyle, color: T.fg3 }}>Loading…</div>
        ) : !entityName ? (
          <div style={{ ...fieldStyle, color: T.fg3 }}>Pick a preview entity</div>
        ) : error ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ ...fieldStyle, color: T.error }}>{error}</div>
            <button
              type="button"
              onClick={() => setRetryCount(count => count + 1)}
              style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        ) : forms.length === 0 ? (
          <div style={{ ...fieldStyle, color: T.fg3 }}>No main forms found</div>
        ) : (
          <select
            value={selectedFormId}
            onChange={e => handleFormChange(e.target.value)}
            style={fieldStyle}
          >
            <option value="">— select form —</option>
            {forms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
