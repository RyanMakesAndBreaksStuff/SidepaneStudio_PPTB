// src/components/CommandStepsTab.tsx
import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig, TriggerKind } from '../types/PaneDefinitionConfig';
import { Field } from './Field';
import { Callout } from './Callout';

const TRIGGER_SUMMARIES: Record<TriggerKind, string> = {
  FormOnLoad:     'Opens automatically when a record form loads.',
  FormOnChange:   'Opens when a specific form field changes value.',
  FormButton:     'Opens when a command bar button is clicked on a record form.',
  MainGridButton: 'Opens when a command bar button is clicked in a main grid view.',
  SubgridButton:  'Opens when a command bar button is clicked in a subgrid.',
  ManualJS:       'Paste directly into the browser console (F12) to open the pane on demand.',
};

const DEPLOY_STEPS: Record<TriggerKind, string[]> = {
  FormOnLoad: [
    'Paste this function into a new JavaScript web resource and publish it.',
    'In the form editor, open <strong>Events → OnLoad</strong>.',
    'Add the web resource as a library, then select the function name. Enable <strong>Pass execution context as first parameter</strong>.',
  ],
  FormOnChange: [
    'Paste this function into a new JavaScript web resource and publish it.',
    'In the form editor, select the field where you want to detect changes.',
    'Open <strong>Events → OnChange</strong> and add the web resource as a library, then select the function name. Enable <strong>Pass execution context as first parameter</strong>.',
  ],
  FormButton: [
    'Paste this function into a new JavaScript web resource and publish it.',
    'Add the web resource to your solution and publish all customizations.',
    'Wire the function to a command bar button using <strong>Command Designer</strong>. In Action parameters, add <code>primaryControl</code> (Primary Control type) as the first argument.',
  ],
  MainGridButton: [
    'Paste this function into a new JavaScript web resource and publish it.',
    'In Command Designer, select <strong>Grid commands</strong> and create a new button with Action: Run JavaScript.',
    'Select your web resource as the library and enter the full function name (including namespace). In Action parameters, add <code>primaryControl</code> (Primary Control type) as the first argument.',
  ],
  SubgridButton: [
    'Paste this function into a new JavaScript web resource and publish it.',
    'In Command Designer, select <strong>Subgrid commands</strong> and create a button with Action: Run JavaScript.',
    'Select your web resource and enter the full function name. In Action parameters, add <code>primaryControl</code> (Primary Control type) as the first argument. This is required — the function reads selected row data from it.',
  ],
  ManualJS: [
    'Copy the entire code block.',
    'Open a model-driven app in your browser and press <strong>F12</strong> to open DevTools.',
    'Paste into the Console tab and press Enter.',
  ],
};

export { TRIGGER_SUMMARIES, DEPLOY_STEPS };

export interface CommandStepsTabProps {
  config: PaneDefinitionConfig;
}

export function CommandStepsTab({ config }: CommandStepsTabProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [copyFallback, setCopyFallback] = useState(false);

  const fqn = `${config.trigger.namespace || 'Ns'}.${config.trigger.functionName || 'fn'}`;
  const steps = DEPLOY_STEPS[config.trigger.kind] ?? [];
  const isManual = config.trigger.kind === 'ManualJS';

  const copyFqn = () => {
    navigator.clipboard.writeText(fqn).catch(() => setCopyFallback(true));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: T.infoBg, border: `1px solid ${T.info}`,
        borderRadius: T.rM, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.info }}>🛠 Command Designer deployment steps</div>
        <div style={{ fontSize: 12, color: T.info, lineHeight: 1.6 }}>
          Your trigger is a <strong>{config.trigger.kind}</strong>. Follow these steps to wire the generated function to your model-driven app.
        </div>
      </div>

      <Field label="Your function name">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: T.surface3, border: `1px solid ${T.stroke1}`, borderRadius: T.rM,
          padding: '8px 10px', fontFamily: T.mono, fontSize: 12, gap: 8,
        }}>
          <span>{isManual ? '(Paste the full code block)' : fqn}</span>
          {!isManual && (
            <button
              onClick={copyFqn}
              style={{
                padding: '2px 8px', background: T.surface1, border: `1px solid ${T.stroke1}`,
                borderRadius: T.rS, fontSize: 11, fontFamily: T.font, cursor: 'pointer',
                color: T.fg2,
              }}
            >
              📋 Copy
            </button>
          )}
        </div>
      </Field>

      {copyFallback && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Callout type="warn" icon="⚠">Clipboard access blocked. Select the text below and copy manually (Ctrl+C / Cmd+C).</Callout>
          <textarea
            readOnly
            value={fqn}
            onClick={e => (e.target as HTMLTextAreaElement).select()}
            style={{ width: '100%', height: 48, fontFamily: T.mono, fontSize: 12, padding: 8, borderRadius: T.rM, border: `1px solid ${T.stroke1}`, resize: 'none' }}
          />
        </div>
      )}

      {!isManual && (
        <Field label="Prerequisites checklist">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Create a new JavaScript web resource and paste the generated <strong>Basic Script</strong> into it',
              'Publish the web resource',
              'Add the web resource to your solution and publish all customizations',
              'Open <strong>Command Designer</strong> for the target table',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: T.fg2 }}>
                <div style={{ width: 14, height: 14, border: `1.5px solid ${T.strokeAcc}`, borderRadius: T.rS, flexShrink: 0, marginTop: 1 }} />
                {/* Content is hardcoded — do not make this string dynamic without sanitizing */}
                <span dangerouslySetInnerHTML={{ __html: text }} />
              </div>
            ))}
          </div>
        </Field>
      )}

      <Field label={isManual ? 'Steps' : 'Wiring steps'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: T.fg2, alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, color: T.fg1, minWidth: 16, flexShrink: 0 }}>{i + 1}.</span>
              {/* Content is hardcoded — do not make this string dynamic without sanitizing */}
              <span dangerouslySetInnerHTML={{ __html: step }} />
            </div>
          ))}
        </div>
      </Field>

      <Callout type="ok" icon="✓">
        After publishing, test by triggering the action in your model-driven app. The side pane should open with the configured content.
      </Callout>
    </div>
  );
}
