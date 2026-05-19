import * as React from 'react';
import { useState, useRef, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { ValidationResult } from '../services/ValidationService';
import { FormXmlService, FormModel } from '../services/FormXmlService';
import { FormSelector, FormSelection } from './FormSelector';
import { FormXmlRenderer } from './FormXmlRenderer';
import { MockMDAShell } from './MockMDAShell';
import { PaneOverlay } from './PaneOverlay';

export interface PreviewPanelProps {
  config: PaneDefinitionConfig;
  validation: ValidationResult;
}

type PreviewMode = 'mock' | 'form';

type FormState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; reason: string }
  | { status: 'loaded'; model: FormModel };

export const PreviewPanel = React.memo(function PreviewPanel({
  config,
  validation,
}: PreviewPanelProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [mode, setMode] = useState<PreviewMode>('mock');
  const [formState, setFormState] = useState<FormState>({ status: 'idle' });

  const formXmlSvcRef = useRef<FormXmlService | null>(null);
  if (!formXmlSvcRef.current) formXmlSvcRef.current = new FormXmlService();

  const handleFormSelected = useCallback(async (selection: FormSelection | null) => {
    if (!selection) {
      setFormState({ status: 'idle' });
      return;
    }
    setFormState({ status: 'loading' });
    const model = await formXmlSvcRef.current!.getFormModel(selection.formId);
    if (!model) {
      setFormState({ status: 'error', reason: 'Could not load form layout. Check your connection.' });
    } else {
      setFormState({ status: 'loaded', model });
    }
  }, []);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    border: 'none',
    borderBottom: active ? `2px solid ${T.accentTeal}` : '2px solid transparent',
    background: 'transparent',
    color: active ? T.accentTeal : T.fg3,
    fontFamily: T.font,
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.pageBg }}>
      {/* Mode tab strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.stroke1}`, background: T.surface2, flexShrink: 0 }}>
        <button style={tabStyle(mode === 'mock')} onClick={() => setMode('mock')}>Mock</button>
        <button style={tabStyle(mode === 'form')} onClick={() => setMode('form')}>Form</button>
      </div>

      {/* Mock mode */}
      {mode === 'mock' && (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 16, gap: 12 }}>
          <MockMDAShell pane={config.pane} target={config.target} validation={validation} />
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: T.fg3, fontFamily: T.font }}>
            {([
              ['Width', `${config.pane.width}px`],
              ['Header', config.pane.hideHeader ? 'Hidden' : 'Visible'],
              ['Close', config.pane.canClose ? '✓' : '–'],
            ] as [string, string][]).map(([label, val]) => (
              <span key={label}>{label}: <strong style={{ color: T.fg1 }}>{val}</strong></span>
            ))}
          </div>
        </div>
      )}

      {/* Form mode */}
      {mode === 'form' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <FormSelector
            entityName={config.target.entityName}
            formXmlService={formXmlSvcRef.current}
            onFormSelected={handleFormSelected}
          />

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            {formState.status === 'idle' && (
              <MockMDAShell pane={config.pane} target={config.target} validation={validation} />
            )}

            {formState.status === 'loading' && (
              <div style={{ color: T.fg3, fontFamily: T.font, fontSize: 13 }}>Loading form layout…</div>
            )}

            {formState.status === 'error' && (
              <div style={{ color: T.error, fontFamily: T.font, fontSize: 13 }}>{formState.reason}</div>
            )}

            {formState.status === 'loaded' && (
              <div style={{
                display: 'flex',
                width: '100%',
                maxWidth: 900,
                height: 480,
                border: `1px solid #EDEBE9`,
                borderRadius: 8,
                boxShadow: '0 8px 20px rgba(0,0,0,.16)',
                overflow: 'hidden',
              }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <FormXmlRenderer model={formState.model} />
                </div>
                <PaneOverlay pane={config.pane} target={config.target} validation={validation} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
