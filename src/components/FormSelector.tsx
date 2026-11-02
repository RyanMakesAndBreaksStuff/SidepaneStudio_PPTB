import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { FormXmlService, FormMeta } from '../services/FormXmlService';
import { TableComboBox } from './TableComboBox';
import { usePreviewSessionState } from '../contexts/PreviewSessionContext';
import { useAccessibleTables, type AccessibleTablesService } from './useAccessibleTables';

export interface FormSelection {
  entityLogicalName: string;
  formId: string;
}

export interface FormSelectorProps {
  /**
   * The entity to load forms for. Host-bound when the trigger has a host picker
   * (PreviewPanel `hostBound`: the pane's table or the RelatedRecord source table),
   * preview-local otherwise. Pass empty string for "not picked yet".
   */
  entityName: string;
  onEntityNameChange: (next: string) => void;
  formXmlService: FormXmlService;
  /**
   * Metadata service — same instance used by Configure's TablePicker. The cache
   * inside MetadataService is shared across both consumers, so the table list
   * is fetched once per session (5-min TTL) regardless of which picker hits it first.
   */
  metadataService: AccessibleTablesService;
  onFormSelected: (selection: FormSelection | null) => void;
  selectedFormId?: string;
  hideEntityPicker?: boolean;
  disabled?: boolean;
}

export function FormSelector({
  entityName,
  onEntityNameChange,
  formXmlService,
  metadataService,
  onFormSelected,
  selectedFormId: controlledFormId,
  hideEntityPicker = false,
  disabled = false,
}: FormSelectorProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [forms, setForms] = useState<FormMeta[]>([]);
  const [localFormId, setSelectedFormId] = useState<string>('');
  const selectedFormId = controlledFormId ?? localFormId;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const requestIdRef = useRef(0);
  const onFormSelectedRef = useRef(onFormSelected);
  onFormSelectedRef.current = onFormSelected;
  const controlledRef = useRef(controlledFormId !== undefined);
  controlledRef.current = controlledFormId !== undefined;

  const [customOnly, setCustomOnly] =
    usePreviewSessionState<boolean>('form-custom-tables-only', false);
  const {
    tables,
    loading: tablesLoading,
    error: tablesError,
    retry: retryTables,
  } = useAccessibleTables(metadataService);
  const tablesLoaded = !tablesLoading && tablesError === undefined;
  const visibleTables = useMemo(() => {
    if (!tablesLoaded) return [];
    return customOnly
      ? tables.filter(table => table.isCustomEntity === true)
      : tables;
  }, [tables, tablesLoaded, customOnly]);
  const formEntity = !hideEntityPicker && customOnly && tablesLoaded &&
    !visibleTables.some(table => table.logicalName === entityName) ? '' : entityName;
  const toggleCustomOnly = () => {
    const next = !customOnly;
    setCustomOnly(next);
    if (next && entityName && tablesLoaded &&
        !tables.some(table => table.logicalName === entityName && table.isCustomEntity === true)) {
      onEntityNameChange('');
    }
  };

  const commitEntity = (next: string) => {
    const trimmed = next.trim();
    if (trimmed !== entityName) onEntityNameChange(trimmed);
  };

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!formEntity) {
      setForms([]);
      setSelectedFormId('');
      setLoading(false);
      setError('');
      if (!controlledRef.current) onFormSelectedRef.current(null);
      return;
    }

    setForms([]);
    setLoading(true);
    setError('');
    setSelectedFormId('');
    if (!controlledRef.current) onFormSelectedRef.current(null);

    formXmlService.getFormsForEntityResult(formEntity).then(result => {
      if (requestIdRef.current !== requestId) return;

      if (!result.ok) {
        setForms([]);
        setLoading(false);
        setError('Could not load main forms.');
        return;
      }

      setForms(result.forms);
      setLoading(false);
      if (!controlledRef.current && result.forms.length === 1) {
        setSelectedFormId(result.forms[0].id);
        onFormSelectedRef.current({ entityLogicalName: formEntity, formId: result.forms[0].id });
      }
    }).catch(() => {
      if (requestIdRef.current !== requestId) return;
      setForms([]);
      setLoading(false);
      setError('Could not load main forms.');
    });
    return () => { requestIdRef.current += 1; };
  }, [formEntity, formXmlService, retryCount]);

  const handleFormChange = (formId: string) => {
    setSelectedFormId(formId);
    if (formId) {
      onFormSelected({ entityLogicalName: formEntity, formId });
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
      {!hideEntityPicker && (
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={labelStyle}>Preview Entity</div>
          <TableComboBox
            value={formEntity}
            onChange={commitEntity}
            items={visibleTables}
            loading={tablesLoading}
            error={tablesError}
            onRetry={retryTables}
            placeholder="Select a table…"
            ariaLabel="Preview entity"
            customOnly={customOnly}
            onCustomOnlyChange={toggleCustomOnly}
            filterDisabled={disabled || !tablesLoaded}
          />
        </div>
      )}
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={labelStyle}>Form</div>
        {loading ? (
          <div style={{ ...fieldStyle, color: T.fg3 }}>Loading…</div>
        ) : !formEntity ? (
          <div style={{ ...fieldStyle, color: T.fg3 }}>Pick a preview entity</div>
        ) : error ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ ...fieldStyle, color: T.error }}>{error}</div>
            <button
              type="button"
              onClick={() => setRetryCount(count => count + 1)}
              style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}
              disabled={disabled}
            >
              Retry
            </button>
          </div>
        ) : forms.length === 0 ? (
          <div style={{ ...fieldStyle, color: T.fg3 }}>No main forms found</div>
        ) : (
          <TableComboBox ariaLabel="Form" noun="forms"
            items={forms.map(f => ({ logicalName: f.id, displayName: f.name, detail: '' }))}
            value={selectedFormId} onChange={handleFormChange}
            placeholder={controlledFormId === undefined ? 'Select a form' : 'Default form'}
            invalid={!!selectedFormId && !forms.some(f => f.id === selectedFormId)} disabled={disabled} />
        )}
      </div>
    </div>
  );
}
