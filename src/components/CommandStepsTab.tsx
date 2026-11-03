// src/components/CommandStepsTab.tsx
import * as React from 'react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { COMMAND_TRIGGERS, PaneDefinitionConfig, TriggerConfig, TriggerKind } from '../types/PaneDefinitionConfig';
import { TRIGGER_CAPABILITIES } from '../services/triggerCapabilities';
import { Field } from './Field';
import { Callout } from './Callout';
import { RUNTIME_WEB_RESOURCE_SUFFIX } from '../constants';
import { copyText } from '../services/clipboard';
import { lookupRegistrarName, resolveTriggerNames } from '../services/CodeGenerationService';

const STEPS: Record<Exclude<TriggerKind, 'GridButton' | 'GridRowSelect'>, React.ReactNode[]> = {
  FormOnLoad: [
    'Paste this function into a new JavaScript web resource and publish it.',
    <React.Fragment key="s1">In the form editor, open <strong>Events → OnLoad</strong>.</React.Fragment>,
    <React.Fragment key="s2">Add the web resource as a library, then select the function name. Enable <strong>Pass execution context as first parameter</strong>.</React.Fragment>,
  ],
  FormOnChange: [
    'Paste this function into a new JavaScript web resource and publish it.',
    'In the form editor, select the field where you want to detect changes.',
    <React.Fragment key="s3">Open <strong>Events → OnChange</strong> and add the web resource as a library, then select the function name. Enable <strong>Pass execution context as first parameter</strong>.</React.Fragment>,
  ],
  LookupTagClick: [
    'Paste this script into a new JavaScript web resource and publish it.',
    <React.Fragment key="s4">In the form editor, open <strong>Form libraries</strong> and add the web resource.</React.Fragment>,
    <React.Fragment key="s5">Open <strong>Events → OnLoad</strong> and add the function shown under <strong>Your function name</strong> (the generated <code>register…</code> function). Keep it enabled and turn on <strong>Pass execution context as first parameter</strong>.</React.Fragment>,
    <React.Fragment key="s6">In the classic form editor, open that handler&apos;s <strong>Dependencies</strong> tab and add each lookup column as a dependent column. The new form designer lists column dependencies for On Save events only, so skip this step there.</React.Fragment>,
  ],
  FormButton: [
    'Paste this function into a new JavaScript web resource and publish it.',
    'Add the web resource to your solution and publish all customizations.',
    <React.Fragment key="s7">Wire the function to a command bar button using <strong>Command Designer</strong>. In Action parameters, add <code>primaryControl</code> (Primary Control type) as the first argument.</React.Fragment>,
  ],
  ManualJS: [
    'Copy the entire code block.',
    <React.Fragment key="s8">Open a model-driven app in your browser and press <strong>F12</strong> to open DevTools.</React.Fragment>,
    'Paste into the Console tab and press Enter.',
  ],
};

/** codegen-config-model-006 — Shared Library output calls SidePaneHelper, so the runtime must load wherever the handler runs. */
function runtimeStep(kind: TriggerKind): React.ReactNode {
  const download = <>Select <strong>Download runtime</strong></>;
  if (kind === 'ManualJS') {
    return <>{download}, then paste the runtime file into the console and press Enter before you paste the generated code.</>;
  }
  // A command runs one library, so the runtime rides along as a web resource dependency.
  // https://learn.microsoft.com/power-apps/maker/model-driven-apps/use-command-designer#use-javascript-for-actions
  const load = COMMAND_TRIGGERS.includes(kind)
    ? <>Command Designer runs one library per command, so open the generated handler&apos;s web resource and add the runtime on its <strong>Dependencies</strong> tab.</>
    : <>Add the runtime as a library everywhere you add the generated handler&apos;s library, such as <strong>Form libraries</strong>.</>;
  return <>{download}, upload it as <code>{'<prefix>_'}{RUNTIME_WEB_RESOURCE_SUFFIX}</code> (your publisher prefix), and publish it. {load}</>;
}

/** Deployment steps for a trigger and output; grid steps name the configured surface. Only Shared Library output needs the runtime. */
export function deploySteps(trigger: TriggerConfig, output: 'basic' | 'library'): React.ReactNode[] {
  const subgrid = trigger.surface === 'subgrid';
  const steps = trigger.kind === 'GridButton' ? [
    'Paste this function into a new JavaScript web resource and publish it.',
    <React.Fragment key="s9">In Command Designer, select <strong>{subgrid ? 'Subgrid commands' : 'Grid commands'}</strong> and create a new button with Action: Run JavaScript.</React.Fragment>,
    <React.Fragment key="s10">Select your web resource as the library and enter the full function name (including namespace). In Action parameters, add <strong>SelectedControl</strong> as the first argument. This is required — SelectedControl is the grid on both main grids and subgrids, and the function reads the selected rows from it.</React.Fragment>,
  ] : trigger.kind === 'GridRowSelect' ? [
    'Paste this function into a new JavaScript web resource and publish it.',
    <React.Fragment key="s11">Enable the <strong>Power Apps grid control</strong> on the {subgrid ? 'form subgrid' : 'table views'}. An <strong>Events</strong> tab appears on the control.</React.Fragment>,
    <React.Fragment key="s12">Add the web resource as a library, then add an <strong>OnRecordSelect</strong> handler. Select the function name and enable <strong>Pass execution context as first parameter</strong>.</React.Fragment>,
  ] : STEPS[trigger.kind];
  return output === 'library' ? [runtimeStep(trigger.kind), ...steps] : steps;
}

export interface CommandStepsTabProps {
  config: PaneDefinitionConfig;
}

export function CommandStepsTab({ config }: CommandStepsTabProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [copyFallback, setCopyFallback] = useState(false);

  // CR-001 — exactly the name the generated script defines; null while the names fail validation.
  const names = resolveTriggerNames(config);
  const fqn = names.ok
    ? `${names.ns}.${config.trigger.kind === 'LookupTagClick' ? lookupRegistrarName(names.fn) : names.fn}`
    : null;
  const nameError = names.ok ? '' : names.errors.map(error => error.message).join(' ');
  // The prerequisites below deploy the Basic Script, so these steps follow it.
  const steps = deploySteps(config.trigger, 'basic');
  const isManual = config.trigger.kind === 'ManualJS';

  const copyFqn = (value: string) => {
    copyText(value)
      .then(() => setCopyFallback(false))
      .catch(() => setCopyFallback(true));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: T.infoBg, border: `1px solid ${T.info}`,
        borderRadius: T.rM, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.info }}>🛠 Command Designer deployment steps</div>
        <div style={{ fontSize: 12, color: T.info, lineHeight: 1.6 }}>
          Your trigger is a <strong>{TRIGGER_CAPABILITIES[config.trigger.kind].label}</strong>. Follow these steps to wire the generated function to your model-driven app.
        </div>
      </div>

      <Field label="Your function name">
        <div style={{
          color:T.fg1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: T.surface3, border: `1px solid ${T.stroke1}`, borderRadius: T.rM,
          padding: '8px 10px', fontFamily: T.mono, fontSize: 12, gap: 8,
        }}>
          {isManual ? <span>(Paste the full code block)</span>
            : fqn !== null ? <span>{fqn}</span>
              : <span role="alert" style={{ color: T.error, fontFamily: T.font }}>{nameError}</span>}
          {!isManual && fqn !== null && (
            <button
              onClick={() => copyFqn(fqn)}
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

      {copyFallback && fqn !== null && (
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
              <React.Fragment key="s13">Create a new JavaScript web resource and paste the generated <strong>Basic Script</strong> into it</React.Fragment>,
              'Publish the web resource',
              'Add the web resource to your solution and publish all customizations',
              <React.Fragment key="s14">Open <strong>Command Designer</strong> for the target table</React.Fragment>,
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: T.fg2 }}>
                <div style={{ width: 14, height: 14, border: `1.5px solid ${T.strokeAcc}`, borderRadius: T.rS, flexShrink: 0, marginTop: 1 }} />
                <span>{text}</span>
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
              <span>{step}</span>
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
