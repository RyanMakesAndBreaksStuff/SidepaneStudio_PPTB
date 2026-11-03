import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandStepsTab, deploySteps } from '../components/CommandStepsTab';
import type { TriggerConfig, TriggerKind } from '../types/PaneDefinitionConfig';
import { cfg } from './testHelpers';

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
});

async function stepsText(trigger: Partial<TriggerConfig>): Promise<string> {
  await act(async () => { root.render(<CommandStepsTab config={cfg({ trigger })} />); });
  return host.textContent ?? '';
}

describe('CommandStepsTab — grid command parameter (codegen-config-model-001)', () => {
  it.each(['main', 'subgrid'] as const)('tells %s grid commands to pass SelectedControl', async surface => {
    const text = await stepsText({ kind: 'GridButton', surface });
    expect(text).toContain('SelectedControl');
    expect(text).not.toContain('primaryControl');
  });

  it('keeps PrimaryControl for form commands', async () => {
    expect(await stepsText({ kind: 'FormButton' })).toContain('primaryControl');
  });
});

describe('deploySteps — Shared Library runtime dependency (codegen-config-model-006)', () => {
  const COMMAND_STEP = 'Command Designer runs one library per command, so open the generated handler\'s web resource and add the runtime on its Dependencies tab.';
  const LIBRARY_STEP = 'Add the runtime as a library everywhere you add the generated handler\'s library, such as Form libraries.';
  const CONSOLE_STEP = 'paste the runtime file into the console and press Enter before you paste the generated code';

  async function deployText(kind: TriggerKind, output: 'basic' | 'library'): Promise<string> {
    const trigger: TriggerConfig = { ...cfg().trigger, kind };
    await act(async () => { root.render(<ol>{deploySteps(trigger, output).map((step, i) => <li key={i}>{step}</li>)}</ol>); });
    return host.textContent ?? '';
  }

  it.each(['FormButton', 'GridButton'] as const)('%s adds the runtime on the handler web resource Dependencies tab', async kind => {
    const text = await deployText(kind, 'library');
    expect(text).toContain('<prefix>_/scripts/sidepane.runtime.js');
    expect(text).toContain(COMMAND_STEP);
  });

  it.each(['FormOnLoad', 'FormOnChange', 'LookupTagClick', 'GridRowSelect'] as TriggerKind[])('%s loads the runtime with the handler library', async kind => {
    const text = await deployText(kind, 'library');
    expect(text).toContain('<prefix>_/scripts/sidepane.runtime.js');
    expect(text).toContain(LIBRARY_STEP);
  });

  it('ManualJS pastes the runtime into the console before the generated code', async () => {
    const text = await deployText('ManualJS', 'library');
    expect(text).toContain(CONSOLE_STEP);
    expect(text).not.toContain('<prefix>_/scripts/sidepane.runtime.js');
  });

  it.each(['FormButton', 'GridButton', 'FormOnLoad', 'FormOnChange', 'LookupTagClick', 'GridRowSelect', 'ManualJS'] as TriggerKind[])(
    '%s Basic Script steps leave out the runtime', async kind => {
      const text = await deployText(kind, 'basic');
      for (const step of ['sidepane.runtime.js', 'Download runtime', 'runtime library', COMMAND_STEP, LIBRARY_STEP, CONSOLE_STEP]) {
        expect(text).not.toContain(step);
      }
    });

  it('Command Steps follows the Basic Script and leaves out the runtime', async () => {
    const text = await stepsText({ kind: 'FormButton' });
    expect(text).not.toContain('sidepane.runtime.js');
    expect(text).not.toContain(COMMAND_STEP);
  });
});
