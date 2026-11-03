import * as React from 'react';
import { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigurePanel } from '../components/ConfigurePanel';
import { DestinationSection } from '../components/config/DestinationSection';
import { ThemeProvider } from '../contexts/ThemeContext';
import { DEFAULT_CONFIG, type PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import { validate } from '../services/ValidationService';
import { coerceConfig } from '../services/triggerCapabilities';
import { describeConfigText } from '../services/describeConfig';
import type { MetadataService } from '../services/MetadataService';
import type { FormXmlService } from '../services/FormXmlService';
import { cfg } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function makeMetadataService(overrides: Partial<MetadataService> = {}): MetadataService {
  return {
    listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
      { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
      { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
    ] }),
    listAccessibleDashboards: vi.fn().mockResolvedValue({ status: 'ok', dashboards: [] }),
    listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
    listLookupAttributes: vi.fn().mockResolvedValue([]),
    listAttributeLabels: vi.fn().mockResolvedValue([]),
    invalidate: vi.fn(),
    subscribeTables: vi.fn(() => () => undefined),
    ...overrides,
  } as unknown as MetadataService;
}

async function render(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<ThemeProvider>{element}</ThemeProvider>); });
}

function sectionButton(title: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll<HTMLButtonElement>('button[aria-expanded]') ?? [])
    .find(button => button.textContent?.includes(title));
}

async function expandSection(title: string): Promise<void> {
  const button = sectionButton(title);
  expect(button).toBeTruthy();
  if (button?.getAttribute('aria-expanded') === 'false') await act(async () => { button.click(); });
}

function chip(group: string, label: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll<HTMLButtonElement>(`[role="radiogroup"][aria-label="${group}"] [role="radio"]`) ?? [])
    .find(button => button.textContent?.includes(label));
}

async function clickChip(group: string, label: string): Promise<void> {
  const button = chip(group, label);
  expect(button).toBeTruthy();
  await act(async () => { button?.click(); });
}

function combo(label: string): HTMLInputElement | null {
  return host?.querySelector<HTMLInputElement>(`[role="combobox"][aria-label="${label}"]`) ?? null;
}

async function chooseOption(label: string, optionText: string): Promise<void> {
  const input = combo(label);
  expect(input).toBeTruthy();
  await act(async () => { input?.focus(); });
  const option = Array.from(host?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    .find(item => item.textContent?.includes(optionText));
  expect(option).toBeTruthy();
  await act(async () => { option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
}

function input(placeholder: string): HTMLInputElement | null {
  return host?.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`) ?? null;
}

async function changeInput(element: HTMLInputElement, value: string): Promise<void> {
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.bind(element);
  await act(async () => { setValue?.(value); element.dispatchEvent(new Event('input', { bubbles: true })); });
}

async function renderPanel(initialConfig: PaneDefinitionConfig = DEFAULT_CONFIG,
  metadataService = makeMetadataService(), formXmlService?: FormXmlService): Promise<() => PaneDefinitionConfig> {
  let current = initialConfig;
  function Workflow(): React.ReactElement {
    const [config, setConfig] = useState(initialConfig);
    current = config;
    return <ConfigurePanel config={config} onChange={updater => setConfig(prev => coerceConfig(updater(prev)))}
      validation={validate(config)} metadataService={metadataService} formXmlService={formXmlService} />;
  }
  await render(<Workflow />);
  await expandSection('Trigger & source');
  await expandSection('Destination');
  return () => current;
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  vi.unstubAllGlobals();
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('ConfigurePanel — sentence', () => {
  it('renders one sentence and jumps to Pane & behaviour', async () => {
    await renderPanel();
    const summary = host?.querySelector('[role="region"][aria-label="Configuration summary"]');
    expect(summary?.textContent).toContain(describeConfigText(DEFAULT_CONFIG));
    expect(sectionButton('Pane & behaviour')?.getAttribute('aria-expanded')).toBe('false');
    await act(async () => { summary?.querySelector<HTMLButtonElement>('[data-slot="pane"]')?.click(); });
    expect(sectionButton('Pane & behaviour')?.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('ConfigurePanel — sentence slots', () => {
  it('re-expands a collapsed section from its sentence slot', async () => {
    await renderPanel();
    for (const [slot, title] of [['trigger', 'Trigger & source'], ['host', 'Trigger & source'], ['target', 'Destination'], ['source', 'Destination']] as const) {
      await act(async () => { sectionButton(title)?.click(); });
      expect(sectionButton(title)?.getAttribute('aria-expanded')).toBe('false');
      await act(async () => { host?.querySelector<HTMLButtonElement>(`[data-slot="${slot}"]`)?.click(); });
      expect(sectionButton(title)?.getAttribute('aria-expanded')).toBe('true');
    }
  });
});

describe('ConfigurePanel — trigger section', () => {
  it('snaps target and source to legal values when the trigger changes', async () => {
    const get = await renderPanel(cfg({ target: { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' },
      context: { source: { kind: 'host' } } }));
    await clickChip('Trigger type', 'Grid button');
    expect(get().target.pageType).not.toBe('entitylist');
    expect(get().context.source.kind).toBe('selectedRow');
    await clickChip('Trigger type', 'Console');
    expect(get().context.source.kind).toBe('fixed');
    await clickChip('Trigger type', 'Lookup tag click');
    await clickChip('Content type', 'Table record');
    expect(get().context.source.kind).toBe('clickedTag');
  });

  it('offers the seven trigger kinds and shows the right host controls', async () => {
    await renderPanel();
    expect(Array.from(host!.querySelectorAll('[role="radiogroup"][aria-label="Trigger type"] [role="radio"]'))).toHaveLength(7);
    await clickChip('Trigger type', 'Grid button');
    expect(chip('Grid surface', 'Main grid')).toBeTruthy();
    expect(chip('Content type', 'Table list')).toBeUndefined();
    expect(combo('View')).toBeTruthy();
    await clickChip('Trigger type', 'Console');
    expect(combo('Trigger table')).toBeNull();
    // Console names are validated, so the fields must stay editable.
    expect(input('openRelatedRecordsPane')).toBeTruthy();
    expect(input('Contoso')).toBeTruthy();
    await clickChip('Trigger type', 'Field change');
    expect(combo('Column')).toBeTruthy();
    await clickChip('Trigger type', 'Lookup tag click');
    expect(combo('Add lookup control')).toBeTruthy();
  });
});

describe('ConfigurePanel — record source', () => {
  it('offers only legal record sources after trigger and content choices', async () => {
    await renderPanel();
    await clickChip('Content type', 'Table record');
    expect(chip('Record source', 'The record on this form')).toBeTruthy();
    expect(chip('Record source', 'A record in a lookup')).toBeTruthy();
    expect(chip('Record source', 'A specific record')).toBeTruthy();
    expect(chip('Record source', 'No record')).toBeUndefined();
    await clickChip('Trigger type', 'Lookup tag click');
    expect(host?.querySelectorAll('[role="radiogroup"][aria-label="Record source"] [role="radio"]')).toHaveLength(1);
    expect(chip('Record source', 'The clicked tag record')).toBeTruthy();
    expect(host?.textContent).toContain('Set by the trigger.');
    await clickChip('Content type', 'Dashboard');
    expect(host?.querySelector('[role="radiogroup"][aria-label="Record source"]')).toBeNull();
  });

  it('shows GUID, record table and variable inputs only when used', async () => {
    await renderPanel();
    await clickChip('Record source', 'A specific record');
    expect(input('00000000-0000-0000-0000-000000000000')).toBeTruthy();
    expect(combo('Record table')).toBeTruthy();
    expect(input('recordId')).toBeTruthy();
    await clickChip('Record source', 'No record');
    expect(input('recordId')).toBeNull();
    await clickChip('Content type', 'Dashboard');
    expect(input('recordId')).toBeNull();
  });
});

describe('ConfigurePanel — destination table', () => {
  it('derives the host table for an existing record and asks for one in create mode', async () => {
    await renderPanel(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } }));
    expect(Array.from(host?.querySelectorAll('[role="status"]') ?? []).some(status =>
      status.textContent?.includes('Destination table: account'))).toBe(true);
    expect(combo('Destination table')).toBeNull();
    await clickChip('Record', 'Create new record');
    expect(combo('Destination table')).toBeTruthy();
  });

  it('reapplies a resolved lookup target when switching to Table record and loads its forms', async () => {
    const listLookupAttributes = vi.fn().mockResolvedValue([{ LogicalName: 'primarycontactid', Targets: ['contact'] }]);
    const getFormsForEntityResult = vi.fn().mockResolvedValue({ ok: true, forms: [] });
    const get = await renderPanel(cfg({ host: { entityName: 'account' }, context: { source: { kind: 'lookup', attribute: '' } } }),
      makeMetadataService({ listLookupAttributes }), { getFormsForEntityResult } as unknown as FormXmlService);
    await chooseOption('Lookup column', 'primarycontactid');
    await clickChip('Content type', 'Table record');
    expect(get().target).toMatchObject({ pageType: 'entityrecord', entityName: 'contact' });
    expect(getFormsForEntityResult).toHaveBeenCalledWith('contact');
  });

  it('lists host lookup columns and stores the chosen column', async () => {
    const listLookupAttributes = vi.fn().mockResolvedValue([
      { LogicalName: 'primarycontactid', DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } } },
    ]);
    const get = await renderPanel(cfg({ host: { entityName: 'account' }, context: { source: { kind: 'lookup', attribute: '' } } }),
      makeMetadataService({ listLookupAttributes }));
    expect(listLookupAttributes).toHaveBeenCalledWith('account');
    await chooseOption('Lookup column', 'Primary Contact');
    expect(get().context.source).toEqual({ kind: 'lookup', attribute: 'primarycontactid' });
  });

  it('derives a single lookup destination and clears incompatible form and tab selections', async () => {
    const listLookupAttributes = vi.fn().mockResolvedValue([{ LogicalName: 'primarycontactid', Targets: ['contact'] }]);
    const get = await renderPanel(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: 'old-form', tabName: 'old-tab', data: '' },
      context: { source: { kind: 'lookup', attribute: '' } } }), makeMetadataService({ listLookupAttributes }));
    await chooseOption('Lookup column', 'primarycontactid');
    expect(get().target).toMatchObject({ entityName: 'contact', formId: '', tabName: '' });
    expect(host?.textContent).toContain('Destination table: contact');
    expect(host?.querySelector<HTMLInputElement>('input[placeholder=""]')).toBeTruthy();
  });

  it('shows multiple possible lookup targets and disables table-specific controls', async () => {
    const listLookupAttributes = vi.fn().mockResolvedValue([
      { LogicalName: 'parentcustomerid', Targets: ['account', 'contact'] },
    ]);
    await renderPanel(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '' },
      context: { source: { kind: 'lookup', attribute: 'parentcustomerid' } } }),
    makeMetadataService({ listLookupAttributes }));
    expect(host?.textContent).toContain('Possible destination tables: account, contact.');
    const tabField = Array.from(host!.querySelectorAll('label')).find(label => label.textContent?.includes('Tab name'))?.parentElement;
    expect(tabField?.querySelector('input')?.disabled).toBe(true);
  });

  it('ignores a delayed lookup response for the prior host table', async () => {
    let resolveAccount!: (value: Array<{ LogicalName: string; Targets: string[] }>) => void;
    const listLookupAttributes = vi.fn((entity: string) => entity === 'account'
      ? new Promise<Array<{ LogicalName: string; Targets: string[] }>>(resolve => { resolveAccount = resolve; })
      : Promise.resolve([{ LogicalName: 'contactlookup', Targets: ['contact'] }]));
    await renderPanel(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '' },
      context: { source: { kind: 'lookup', attribute: '' } } }), makeMetadataService({ listLookupAttributes }));
    await chooseOption('Trigger table', 'contact');
    resolveAccount([{ LogicalName: 'staleaccountlookup', Targets: ['account'] }]);
    await act(async () => { await Promise.resolve(); });
    expect(host?.textContent).not.toContain('staleaccountlookup');
    await chooseOption('Lookup column', 'contactlookup');
    expect(host?.textContent).toContain('Destination table: contact');
  });

  it('preserves saved destination on lookup error and retries into the resolved target', async () => {
    const listLookupAttributes = vi.fn().mockRejectedValueOnce(new Error('connection unavailable'))
      .mockResolvedValueOnce([{ LogicalName: 'primarycontactid', Targets: ['contact'] }]);
    const get = await renderPanel(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: 'saved-form', tabName: 'saved-tab', data: '' },
      context: { source: { kind: 'lookup', attribute: 'primarycontactid' } } }),
    makeMetadataService({ listLookupAttributes }));
    expect(host?.textContent).toContain('connection unavailable');
    expect(host?.textContent).toContain('Saved table selection “account” is unconfirmed');
    expect(get().target).toMatchObject({ formId: 'saved-form', tabName: 'saved-tab' });
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Retry')?.click(); });
    expect(host?.textContent).toContain('Destination table: contact');
    expect(get().target).toMatchObject({ formId: '', tabName: '' });
    expect(listLookupAttributes).toHaveBeenCalledTimes(2);
  });

  it('ignores metadata returned by a replaced metadata service instance', async () => {
    let resolveOld!: (value: Array<{ LogicalName: string; Targets: string[] }>) => void;
    const oldService = makeMetadataService({ listLookupAttributes: vi.fn(() =>
      new Promise<Array<{ LogicalName: string; Targets: string[] }>>(resolve => { resolveOld = resolve; })) });
    const newService = makeMetadataService({ listLookupAttributes: vi.fn().mockResolvedValue([
      { LogicalName: 'newservice_lookup', Targets: ['contact'] },
    ]) });
    const config = cfg({ host: { entityName: 'account' }, context: { source: { kind: 'lookup', attribute: '' } } });
    const onChange = vi.fn();
    await render(<ConfigurePanel config={config} onChange={onChange} validation={validate(config)} metadataService={oldService} />);
    await act(async () => { root?.render(<ThemeProvider>
      <ConfigurePanel config={config} onChange={onChange} validation={validate(config)} metadataService={newService} />
    </ThemeProvider>); });
    resolveOld([{ LogicalName: 'oldservice_lookup', Targets: ['account'] }]);
    await act(async () => { await Promise.resolve(); });
    expect(host?.textContent).not.toContain('oldservice_lookup');
    await chooseOption('Lookup column', 'newservice_lookup');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('ConfigurePanel — create mode', () => {
  it('limits Create new record sources to the host record or none, and offers a destination table', async () => {
    await renderPanel(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } }));
    await clickChip('Record', 'Create new record');
    expect(chip('Record source', 'The record on this form')).toBeTruthy();
    expect(chip('Record source', 'No record')).toBeTruthy();
    expect(chip('Record source', 'A specific record')).toBeUndefined();
    expect(chip('Record source', 'A record in a lookup')).toBeUndefined();
    expect(combo('Destination table')).toBeTruthy();
    await clickChip('Trigger type', 'Grid button');
    expect(chip('Record source', 'The selected row')).toBeTruthy();
    expect(chip('Record source', 'The record on this form')).toBeUndefined();
  });
});

describe('ConfigurePanel — existing controls', () => {
  it('keeps dashboard and search choices, validation and search text changes', async () => {
    const listAccessibleDashboards = vi.fn().mockResolvedValue({ status: 'ok', dashboards: [] });
    const get = await renderPanel(DEFAULT_CONFIG, makeMetadataService({ listAccessibleDashboards }));
    await clickChip('Content type', 'Dashboard');
    expect(combo('Dashboard')).toBeTruthy();
    expect(host?.textContent).toContain('Dashboard is required');
    expect(listAccessibleDashboards).toHaveBeenCalled();
    await clickChip('Content type', 'Search');
    expect(host?.textContent).toContain('Pre-fill the global search box');
    await changeInput(input('e.g. Contoso')!, 'Contoso');
    expect(get().target).toEqual({ pageType: 'search', searchText: 'Contoso' });
    expect(host?.textContent).toContain('not a documented navigateTo pageType');
  });

  it('keeps behavior controls and metadata filters in order', async () => {
    await render(<ConfigurePanel config={DEFAULT_CONFIG} onChange={vi.fn()} validation={validate(DEFAULT_CONFIG)}
      metadataService={makeMetadataService()} metadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
      defaultMetadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG} metadataFilterPersistenceAvailable
      onSaveMetadataFilterConfig={vi.fn()} onResetMetadataFilterConfig={vi.fn()} />);
    await expandSection('Pane & behaviour');
    const text = host?.textContent ?? '';
    expect(text.indexOf('Open in foreground (isSelected)')).toBeLessThan(text.indexOf('Keep loaded when inactive'));
    expect(text.indexOf('Initial badge value')).toBeLessThan(text.indexOf('Metadata table filters'));
    expect(host?.querySelector('[role="switch"][aria-label="Reuse open pane"]')).toBeTruthy();
    expect(text).toContain('Deny prefixes');
  });

  it('keeps pane width error, icon guidance, and hide-header warning', async () => {
    const config = cfg({ pane: { width: 1201, hideHeader: true, canClose: true } });
    await renderPanel(config);
    await expandSection('Pane & behaviour');
    expect(host?.textContent).toContain('Pane width must be between 300 and 1200 pixels.');
    expect(input('WebResources/sps_/icons/myicon.svg')).toBeTruthy();
    expect(host?.textContent).toContain('Hiding the header also hides the close button');
    expect(host?.textContent).not.toMatch(/Resizable toggle/i);
  });

  it('keeps form data guidance and inserts its example', async () => {
    const get = await renderPanel(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } }));
    const area = host?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Form data"]');
    expect(area?.placeholder).toContain('"name"');
    expect(host?.textContent).toContain('Choose Create new record to pre-fill columns');
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Insert example')?.click(); });
    const target = get().target;
    if (target.pageType !== 'entityrecord') throw new Error('expected an entityrecord target');
    expect(JSON.parse(target.data)).toMatchObject({ name: expect.any(String) });
  });

  it('keeps generative page ID, data and guidance, including stale updater guard', async () => {
    const config = cfg({ target: { pageType: 'generative', pageId: '', data: '' } });
    const onChange = vi.fn();
    await render(<ConfigurePanel config={config} onChange={onChange} validation={validate(config)} metadataService={makeMetadataService()} />);
    const pageId = input('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    expect(pageId).toBeTruthy();
    expect(host?.querySelector('textarea[aria-label="Page data"]')).toBeTruthy();
    expect(host?.textContent).toContain('Page ID must be the GUID of a generative page.');
    expect(host?.querySelector<HTMLAnchorElement>('a[href*="generative-pages"]')).toBeTruthy();
    await changeInput(pageId!, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    const updater = onChange.mock.calls[0][0] as (prev: PaneDefinitionConfig) => PaneDefinitionConfig;
    const other = cfg({ target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } });
    expect(updater(other)).toBe(other);
  });

  it('maps create mode pre-fill to the record source and limits console to no record', async () => {
    await renderPanel(cfg({ target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true },
      context: { source: { kind: 'host' } } }));
    expect(chip('Record source', 'The record on this form')).toBeTruthy();
    expect(host?.textContent).toContain('In create mode these values pre-fill columns');
    await clickChip('Trigger type', 'Console');
    expect(chip('Record source', 'No record')).toBeTruthy();
    expect(host?.querySelectorAll('[role="radiogroup"][aria-label="Record source"] [role="radio"]')).toHaveLength(1);
  });
});

describe('DestinationSection — stale updaters', () => {
  type Updater = (prev: PaneDefinitionConfig) => PaneDefinitionConfig;

  async function captureUpdater(config: PaneDefinitionConfig, placeholder: string, value: string): Promise<Updater> {
    const onChange = vi.fn();
    await render(<DestinationSection config={config} onChange={onChange} metadataService={makeMetadataService()}
      errors={{}} warnings={{}} />);
    const element = input(placeholder);
    expect(element).toBeTruthy();
    await changeInput(element as HTMLInputElement, value);
    expect(onChange).toHaveBeenCalledTimes(1);
    return onChange.mock.calls[0][0] as Updater;
  }

  it('patchTarget ignores an updater queued for a different page type', async () => {
    const updater = await captureUpdater(
      cfg({ target: { pageType: 'custom', name: '' } }), 'sps_SidePaneBuilderPage', 'sps_Other');
    const stale = cfg({ target: { pageType: 'webresource', name: 'sps_/pages/a.html' } });
    expect(updater(stale)).toBe(stale);
    expect(updater(cfg({ target: { pageType: 'custom', name: '' } })).target).toEqual({ pageType: 'custom', name: 'sps_Other' });
  });

  it('patchSource ignores an updater queued for a different source kind', async () => {
    const updater = await captureUpdater(
      cfg({ target: { pageType: 'custom', name: 'sps_Page' }, context: { source: { kind: 'fixed', entityName: '', id: '' } } }),
      '00000000-0000-0000-0000-000000000000', 'abc');
    const stale = cfg({ target: { pageType: 'custom', name: 'sps_Page' }, context: { source: { kind: 'none' } } });
    expect(updater(stale)).toBe(stale);
    const fresh = cfg({ context: { source: { kind: 'fixed', entityName: 'account', id: '' } } });
    expect(updater(fresh).context.source).toEqual({ kind: 'fixed', entityName: 'account', id: 'abc' });
  });
});
