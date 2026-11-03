import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidePaneBuilderWorkbench } from '../SidePaneBuilderWorkbench';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import type { ValidationResult } from '../services/ValidationService';
import { deferred } from './testHelpers';

// W20 — the real shell and Output panel; the config panel only reports validation and picks org-scoped selections.
vi.mock('../components/ConfigurePanel', () => ({
  ConfigurePanel: ({ config, validation, onChange }: {
    config: PaneDefinitionConfig;
    validation: ValidationResult;
    onChange: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
  }) => <>
    <output data-testid="formId">{config.target.pageType === 'entityrecord' ? config.target.formId : ''}</output>
    <output data-testid="warnings">{validation.warnings.map(w => w.field).join(' ')}</output>
    <output data-testid="errors">{validation.errors.map(e => e.field).join(' ')}</output>
    <button type="button" onClick={() => onChange(prev => ({ ...prev,
      trigger: { ...prev.trigger, namespace: 'Contoso' },
      host: { ...prev.host, entityName: 'account' },
      target: {
        pageType: 'entityrecord', entityName: 'account', formId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        tabName: '', data: '', createNew: false,
      } }))}>Pick account form</button>
    {/* The record opens from the host form, so coerceConfig derives the target table and drops the form. */}
    <button type="button" onClick={() => onChange(prev => ({ ...prev, host: { ...prev.host, entityName: 'contact' } }))}>
      Pick contact table
    </button>
    <button type="button" onClick={() => onChange(prev => ({ ...prev, pane: { ...prev.pane, title: 'Edited' } }))}>
      Edit title
    </button>
  </>,
}));
vi.mock('../components/PreviewPanel', () => ({ PreviewPanel: () => null }));

const ORG_A = { id: 'conn-a', name: 'Org A', url: 'https://OrgA.crm.dynamics.com/' };
const ORG_B = { id: 'conn-b', name: 'Org B', url: 'https://orgb.crm.dynamics.com' };
const SAVED_FORM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SAVED: PaneDefinitionConfig = {
  ...DEFAULT_CONFIG,
  trigger: { ...DEFAULT_CONFIG.trigger, namespace: 'Contoso' },
  // The opened record is the host form's record, so the target table must match the host table to survive coerceConfig.
  host: { ...DEFAULT_CONFIG.host, entityName: 'account' },
  target: { pageType: 'entityrecord', entityName: 'account', formId: SAVED_FORM_ID, tabName: '', data: '', createNew: false },
};
const BANNER = 'This configuration was saved for a different environment; table, form, view and page selections are unverified.';

type Handler = (event: unknown, payload: ToolBoxAPI.ToolBoxEventPayload) => void;
let root: Root | undefined;
let host: HTMLDivElement | undefined;
let stored: string | null;
let handler: Handler | undefined;
let getActiveConnection: ReturnType<typeof vi.fn>;

function stubToolbox(connection: unknown) {
  getActiveConnection = vi.fn(async () => connection);
  vi.stubGlobal('toolboxAPI', {
    connections: { getActiveConnection },
    events: { on: vi.fn((callback: Handler) => { handler = callback; }), off: vi.fn() },
    settings: {
      get: vi.fn(async (key: string) => key === 'lastConfig' ? stored : null),
      set: vi.fn(async (key: string, value: string | null) => { if (key === 'lastConfig') stored = value; }),
      getAll: vi.fn().mockResolvedValue({}),
    },
  });
}

async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<SidePaneBuilderWorkbench />); });
  await act(async () => { await Promise.resolve(); });
}

async function unmount() {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll('button') ?? []).find(b => b.textContent?.includes(label));
}

async function click(label: string) {
  const target = button(label);
  if (!target) throw new Error(`Button ${label} was not found`);
  await act(async () => { target.click(); });
}

async function flushSave() {
  await act(async () => { vi.advanceTimersByTime(500); await Promise.resolve(); });
}

const warnings = () => host?.querySelector('[data-testid="warnings"]')?.textContent?.split(' ') ?? [];
const errors = () => host?.querySelector('[data-testid="errors"]')?.textContent ?? '';
const copyButton = () => button('Copy');

/** The restored form selection is present, yet nothing flags it and copy is available. */
function expectClean() {
  expect(host?.querySelector('[data-testid="formId"]')?.textContent).toBe(SAVED_FORM_ID);
  expect(host?.textContent).not.toContain(BANNER);
  expect(button('Use anyway')).toBeUndefined();
  expect(warnings()).not.toContain('target.formId');
  expect(copyButton()?.disabled).toBe(false);
}

beforeEach(() => {
  vi.useFakeTimers();
  stored = null;
  handler = undefined;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});

afterEach(async () => {
  await unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('restoring a configuration saved for another environment (W20)', () => {
  it('flags org A selections restored under org B and blocks copy until the user confirms', async () => {
    stubToolbox(ORG_A);
    await mount();
    await click('Pick account form');
    await flushSave();
    expect(JSON.parse(stored!).orgKey).toBe('orga.crm.dynamics.com');
    await unmount();

    stubToolbox(ORG_B);
    await mount();
    expect(errors()).toBe('');
    expect(host?.textContent).toContain(BANNER);
    expect(warnings()).toEqual(expect.arrayContaining(['target.entityName', 'target.formId']));
    expect(copyButton()?.disabled).toBe(true);

    await click('Use anyway');
    expectClean();
    // Confirming adopts the configuration for org B, so the next restore here is clean.
    await flushSave();
    expect(JSON.parse(stored!).orgKey).toBe('orgb.crm.dynamics.com');
  });

  it('restores a configuration saved for the same environment without a flag', async () => {
    stored = JSON.stringify({ ...SAVED, orgKey: 'orga.crm.dynamics.com' });
    stubToolbox(ORG_A);
    await mount();
    expect(errors()).toBe('');
    expectClean();
  });

  it('restores a legacy configuration without an org key without a flag', async () => {
    stored = JSON.stringify(SAVED);
    stubToolbox(ORG_B);
    await mount();
    expect(errors()).toBe('');
    expectClean();
  });

  it('compares once a connection that arrives after the restore is known', async () => {
    stored = JSON.stringify({ ...SAVED, orgKey: 'orga.crm.dynamics.com' });
    const connection = deferred<typeof ORG_B>();
    stubToolbox(null);
    getActiveConnection.mockReturnValue(connection.promise);
    await mount();
    expect(host?.textContent).toContain('Connecting to Dataverse');
    await act(async () => { connection.resolve(ORG_B); });
    expect(host?.textContent).toContain(BANNER);
    expect(copyButton()?.disabled).toBe(true);
  });

  it('keeps org A for unconfirmed edits and treats re-picking a selection in org B as confirmation', async () => {
    stored = JSON.stringify({ ...SAVED, orgKey: 'orga.crm.dynamics.com' });
    stubToolbox(ORG_B);
    await mount();
    await click('Edit title');
    await flushSave();
    expect(JSON.parse(stored!).orgKey).toBe('orga.crm.dynamics.com');
    expect(host?.textContent).toContain(BANNER);

    await click('Pick contact table');
    expect(host?.textContent).not.toContain(BANNER);
    expect(button('Use anyway')).toBeUndefined();
    expect(copyButton()?.disabled).toBe(false);
    await flushSave();
    expect(JSON.parse(stored!)).toMatchObject({ orgKey: 'orgb.crm.dynamics.com', host: { entityName: 'contact' } });
  });

  it('saves no org key and never flags when the connection has no usable URL', async () => {
    stubToolbox({ id: 'conn-a', name: 'Org A', url: 'not a url' });
    await mount();
    await click('Pick account form');
    await flushSave();
    expect(JSON.parse(stored!)).not.toHaveProperty('orgKey');
    await unmount();

    stored = JSON.stringify({ ...SAVED, orgKey: 'orga.crm.dynamics.com' });
    stubToolbox({ id: 'conn-b', name: 'Org B' });
    await mount();
    expectClean();
  });

  it('drops the flag when a live switch clears the restored selections', async () => {
    stored = JSON.stringify({ ...SAVED, orgKey: 'orga.crm.dynamics.com' });
    stubToolbox(ORG_B);
    await mount();
    expect(host?.textContent).toContain(BANNER);
    getActiveConnection.mockResolvedValue(ORG_A);
    await act(async () => {
      handler?.({ senderId: 'ipc' }, { event: 'connection:updated', data: null, timestamp: '2026-11-02' });
      await Promise.resolve();
    });
    expect(host?.textContent).not.toContain(BANNER);
    expect(button('Use anyway')).toBeUndefined();
  });
});
