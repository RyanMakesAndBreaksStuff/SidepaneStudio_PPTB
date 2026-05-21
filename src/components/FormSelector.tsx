import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { FormXmlService, FormMeta } from '../services/FormXmlService';

export interface FormSelection {
  entityLogicalName: string;
  formId: string;
}

export interface FormSelectorProps {
  entityName: string;
  formXmlService: FormXmlService;
  onFormSelected: (selection: FormSelection | null) => void;
}

export function FormSelector({
  entityName,
  formXmlService,
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

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!entityName) {
      setForms([]);
      setSelectedFormId('');
      setLoading(false);
      setError('');
      onFormSelected(null);
      return;
    }

    setLoading(true);
    setError('');
    setSelectedFormId('');
    onFormSelected(null);

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
        onFormSelected({ entityLogicalName: entityName, formId: result.forms[0].id });
      }
    }).catch(() => {
      if (requestIdRef.current !== requestId) return;
      setForms([]);
      setLoading(false);
      setError('Could not load main forms.');
    });
  }, [entityName, formXmlService, onFormSelected, retryCount]);

  const handleFormChange = (formId: string) => {
    setSelectedFormId(formId);
    if (formId) {
      onFormSelected({ entityLogicalName: entityName, formId });
    } else {
      onFormSelected(null);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: T.fg3,
    fontFamily: T.font,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: 2,
  };
  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    border: `1px solid ${T.stroke1}`,
    borderRadius: T.rS,
    background: T.surface1,
    color: T.fg1,
    fontFamily: T.font,
    fontSize: 13,
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', padding: '8px 12px', background: T.surface2, borderBottom: `1px solid ${T.stroke1}` }}>
      <div style={{ flex: 1 }}>
        <div style={labelStyle}>Entity</div>
        <div style={{ ...selectStyle, color: entityName ? T.fg1 : T.fg3 }}>
          {entityName || '— not configured —'}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={labelStyle}>Form</div>
        {loading ? (
          <div style={{ ...selectStyle, color: T.fg3 }}>Loading…</div>
        ) : !entityName ? (
          <div style={{ ...selectStyle, color: T.fg3 }}>Configure entity first</div>
        ) : error ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ ...selectStyle, color: T.error }}>{error}</div>
            <button
              type="button"
              onClick={() => setRetryCount(count => count + 1)}
              style={{ ...selectStyle, width: 'auto', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        ) : forms.length === 0 ? (
          <div style={{ ...selectStyle, color: T.fg3 }}>No main forms found</div>
        ) : (
          <select
            value={selectedFormId}
            onChange={e => handleFormChange(e.target.value)}
            style={selectStyle}
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
