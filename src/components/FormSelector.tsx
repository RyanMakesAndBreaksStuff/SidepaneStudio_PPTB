import * as React from 'react';
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!entityName) {
      setForms([]);
      setSelectedFormId('');
      onFormSelected(null);
      return;
    }
    setLoading(true);
    setSelectedFormId('');
    onFormSelected(null);
    formXmlService.getFormsForEntity(entityName).then(fetched => {
      setForms(fetched);
      setLoading(false);
      if (fetched.length === 1) {
        setSelectedFormId(fetched[0].id);
        onFormSelected({ entityLogicalName: entityName, formId: fetched[0].id });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityName]);

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
