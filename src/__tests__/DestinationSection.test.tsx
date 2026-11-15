import * as React from 'react';
import { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationSection } from '../components/config/DestinationSection';
import { ThemeProvider } from '../contexts/ThemeContext';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { coerceConfig } from '../services/triggerCapabilities';
import type { MetadataService } from '../services/MetadataService';
import type { FormXmlService } from '../services/FormXmlService';
import { cfg, chooseOption } from './testHelpers';

type Updater = (prev: PaneDefinitionConfig) => PaneDefinitionConfig;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function makeMetadataService(): MetadataService {
  return {
    listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
      { logicalName: 'account', displayName: 'Account' },
      { logicalName: 'contact', displayName: 'Contact' },
    ] }),
    listAccessibleDashboards: vi.fn().mockResolvedValue({ status: 'ok', dashboards: [] }),
    listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
    listLookupAttributes: vi.fn().mockResolvedValue([]),
    listAttributeLabels: vi.fn().mockResolvedValue([]),
    invalidate: vi.fn(),
    subscribeTables: vi.fn(() => () => undefined),
  } as unknown as MetadataService;
}

const getFormsForEntityResult = vi.fn().mockResolvedValue({ ok: true, forms: [] });
const formXmlService = { getFormsForEntityResult } as unknown as FormXmlService;

async function render(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<ThemeProvider>{element}</ThemeProvider>); });
}

/** Renders the section against live state, the way the workbench coerces every change. */
async function renderSection(initial: PaneDefinitionConfig, metadataService = makeMetadataService()): Promise<() => PaneDefinitionConfig> {
  let current = initial;
  function Harness(): React.ReactElement {
    const [config, setConfig] = useState(initial);
    current = config;
    return <DestinationSection config={config} onChange={updater => setConfig(prev => coerceConfig(updater(prev)))}
      metadataService={metadataService} formXmlService={formXmlService} errors={{}} warnings={{}} />;
  }
  await render(<Harness />);
  return () => current;
}

function pill(group: string, label: string): HTMLButtonElement {
  const button = Array.from(host?.querySelectorAll<HTMLButtonElement>(`[role="radiogroup"][aria-label="${group}"] [role="radio"]`) ?? [])
    .find(item => item.textContent?.includes(label));
  if (!button) throw new Error(`Pill ${label} was not found in ${group}`);
  return button;
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => { element.click(); });
}

async function changeText(element: HTMLTextAreaElement, value: string): Promise<void> {
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.bind(element);
  await act(async () => { setValue?.(value); element.dispatchEvent(new Event('input', { bubbles: true })); });
}

function fieldLabel(text: string): HTMLLabelElement | undefined {
  return Array.from(host?.querySelectorAll('label') ?? []).find(label => label.textContent === text);
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('DestinationSection — destination table warnings', () => {
  const warned = ['Table "account" is not in the current table list for this environment.', 'A second note.'];

  it.each([
    ['a table record', cfg({ trigger: { kind: 'ManualJS' }, context: { source: { kind: 'fixed', entityName: '', id: '' } },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '', createNew: false } })],
    ['a table list', cfg({ trigger: { kind: 'ManualJS' }, context: { source: { kind: 'none' } },
      target: { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' } })],
  ])('shows every target.entityName warning beside the destination table of %s', async (_name, config) => {
    await render(<DestinationSection config={config} onChange={vi.fn()} metadataService={makeMetadataService()}
      errors={{}} warnings={{ 'target.entityName': warned }} />);
    const field = fieldLabel('Destination table *')?.parentElement;
    expect(field?.textContent).toContain(warned[0]);
    expect(field?.textContent).toContain(warned[1]);
  });
});

describe('DestinationSection — console record source', () => {
  const sourceHint = () => fieldLabel('Record source')?.parentElement?.textContent ?? '';

  it('explains why an existing table record needs a specific record from the console', async () => {
    await renderSection(cfg({ trigger: { kind: 'ManualJS' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '', createNew: false },
      context: { source: { kind: 'fixed', entityName: '', id: '' } } }));
    expect(sourceHint()).toContain('The console runs outside any form or grid');
    expect(sourceHint()).not.toContain('Set by the trigger.');
  });

  it('keeps the plain hint where the trigger fixes the source for another reason', async () => {
    await renderSection(cfg({ trigger: { kind: 'LookupTagClick' }, context: { source: { kind: 'clickedTag' } } }));
    expect(sourceHint()).toContain('Set by the trigger.');
  });

  it('shows no hint while the console offers a choice', async () => {
    await renderSection(cfg({ trigger: { kind: 'ManualJS' }, context: { source: { kind: 'none' } } }));
    expect(sourceHint()).not.toContain('Set by the trigger.');
    expect(sourceHint()).not.toContain('The console runs outside');
  });
});

describe('DestinationSection — re-clicking the selected pill (W8)', () => {
  it('keeps the custom page name when Custom page is clicked again', async () => {
    const get = await renderSection(cfg({ target: { pageType: 'custom', name: 'sps_Page' } }));
    await click(pill('Content type', 'Custom page'));
    expect(get().target).toEqual({ pageType: 'custom', name: 'sps_Page' });
  });

  it('keeps a fixed record GUID when A specific record is clicked again', async () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const get = await renderSection(cfg({ target: { pageType: 'custom', name: 'sps_Page' },
      context: { source: { kind: 'fixed', entityName: 'account', id } } }));
    await click(pill('Record source', 'A specific record'));
    expect(get().context.source).toEqual({ kind: 'fixed', entityName: 'account', id });
  });

  it('keeps create mode and no-record source when Table record is clicked again', async () => {
    const get = await renderSection(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true },
      context: { source: { kind: 'none' } } }));
    await click(pill('Content type', 'Table record'));
    await click(pill('Record', 'Create new record'));
    await click(pill('Record source', 'No record'));
    expect(get().context.source).toEqual({ kind: 'none' });
    expect(get().target).toMatchObject({ entityName: 'contact', createNew: true });
  });

  it('returns the previous config from a content or source updater whose choice is already applied', async () => {
    const onChange = vi.fn();
    const config = cfg({ target: { pageType: 'custom', name: 'sps_Page' }, context: { source: { kind: 'host' } } });
    await render(<DestinationSection config={config} onChange={onChange} metadataService={makeMetadataService()}
      errors={{}} warnings={{}} />);
    await click(pill('Content type', 'Web resource'));
    await click(pill('Record source', 'No record'));
    const [toWebResource, toNoRecord] = onChange.mock.calls.map(([updater]) => updater as Updater);
    const webResource = cfg({ target: { pageType: 'webresource', name: 'sps_/pages/a.html' } });
    expect(toWebResource(webResource)).toBe(webResource);
    const noRecord = cfg({ context: { source: { kind: 'none' } } });
    expect(toNoRecord(noRecord)).toBe(noRecord);
  });
});

describe('DestinationSection — form data across table picks (W9)', () => {
  it('keeps form data typed before the first table pick and clears it when the table changes', async () => {
    const get = await renderSection(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '', createNew: true },
      context: { source: { kind: 'none' } } }));
    const data = '{"name":"Contoso"}';
    await changeText(host!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Form data"]')!, data);
    await chooseOption(host!, 'Destination table', 'Account');
    expect(get().target).toMatchObject({ entityName: 'account', data });
    await chooseOption(host!, 'Destination table', 'Contact');
    expect(get().target).toMatchObject({ entityName: 'contact', data: '' });
  });
});

describe('DestinationSection — clicked tag source (W10)', () => {
  it('hides form and tab pickers and says the clicked tag decides the table', async () => {
    await renderSection(cfg({ trigger: { kind: 'LookupTagClick' }, host: { lookupControls: ['parentaccountid'] },
      target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '' },
      context: { source: { kind: 'clickedTag' } } }));
    expect(host?.textContent).not.toContain('Choose a table');
    expect(host?.textContent?.toLowerCase()).toContain('determined by the clicked tag');
    expect(fieldLabel('Form')).toBeUndefined();
    expect(fieldLabel('Tab name')).toBeUndefined();
  });
});

describe('DestinationSection — lookup destination copy', () => {
  const lookups = [
    { LogicalName: 'primarycontactid', Targets: ['contact'], DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } } },
    { LogicalName: 'parentcustomerid', Targets: ['account', 'contact'], DisplayName: { UserLocalizedLabel: { Label: 'Parent Customer' } } },
    { LogicalName: 'orphanid', Targets: [], DisplayName: { UserLocalizedLabel: { Label: 'Orphan' } } },
  ];
  const lookupService = () => Object.assign(makeMetadataService(), { listLookupAttributes: vi.fn().mockResolvedValue(lookups) });
  // The Form combobox renders only once the table has forms; clear calls so each test proves its own request.
  beforeEach(() => { getFormsForEntityResult.mockClear().mockResolvedValue({ ok: true, forms: [{ id: 'contact-main', name: 'Contact form' }] }); });
  afterEach(() => { getFormsForEntityResult.mockResolvedValue({ ok: true, forms: [] }); });
  const related = (attribute: string) => cfg({ trigger: { kind: 'GridRowSelect' }, host: { entityName: 'account' },
    target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '', createNew: false },
    context: { source: { kind: 'lookup', attribute } } });
  // Field renders <div><label>Destination table</label>{children}…</div>, so the label's parent scopes the field.
  const destinationStatus = () => Array.from(host!.querySelectorAll<HTMLElement>('[role="status"]'))
    .find(status => fieldLabel('Destination table')?.parentElement?.contains(status))!;

  it('says the Lookup column selector decides the table while no lookup is chosen', async () => {
    await renderSection(related(''), lookupService());
    expect(destinationStatus().textContent).toBe("Destination table is determined by the 'Lookup column' selector.");
  });

  it('shows the table name, then the lookup copy, and enables the form picker for that table', async () => {
    const get = await renderSection(related(''), lookupService());
    await chooseOption(host!, 'Lookup column', 'Primary Contact');
    const status = destinationStatus();
    expect(Array.from(status.children).map(line => line.textContent)).toEqual([
      'contact', 'Destination table: determined by the primarycontactid lookup.']);
    expect(get().target).toMatchObject({ entityName: 'contact', formId: '', tabName: '' });
    // The Lookup column picker does not repeat the destination under itself.
    expect(host!.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(host!.textContent).not.toContain('Destination table: contact');
    expect(host!.textContent).not.toContain('Choose a table to pick a form.');
    expect(host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Form"]')?.disabled).toBe(false);
    expect(getFormsForEntityResult).toHaveBeenCalledWith('contact');
  });

  it('lists logical names for a polymorphic lookup and keeps the form picker off', async () => {
    await renderSection(related(''), lookupService());
    await chooseOption(host!, 'Lookup column', 'Parent Customer');
    expect(destinationStatus().textContent).toBe('Possible destination tables: account, contact. Determined by the selected row.');
    expect(host!.textContent).toContain('Choose a table to pick a form.');
  });

  it('says a lookup with no related tables has no destination, in the field and under the picker', async () => {
    await renderSection(related(''), lookupService());
    await chooseOption(host!, 'Lookup column', 'Orphan');
    expect(destinationStatus().textContent).toBe('No destination table: the orphanid lookup has no related tables.');
    expect(host!.textContent).toContain('The “orphanid” lookup has no related tables, so there is no record to open.');
    expect(host!.textContent).toContain('Choose a table to pick a form.');
  });
});

describe('DestinationSection — docs links', () => {
  const formDataConfig = () => cfg({ host: { entityName: 'account' },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true },
    context: { source: { kind: 'none' } } });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function clickDocsLink(): Promise<MouseEvent> {
    const link = Array.from(host!.querySelectorAll('a')).find(a => a.textContent === 'Set column values')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      link.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    return event;
  }

  it('opens the link in the connection browser when the host can', async () => {
    const openInConnectionBrowser = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { utils: { getCurrentTheme: vi.fn().mockResolvedValue('dark'), openInConnectionBrowser } });
    await renderSection(formDataConfig());
    const event = await clickDocsLink();
    expect(event.defaultPrevented).toBe(true);
    expect(openInConnectionBrowser).toHaveBeenCalledWith(expect.stringContaining('set-field-values-using-parameters-passed-form'));
  });

  it.each([
    ['is absent on an older host', {}],
    ['rejects', { openInConnectionBrowser: vi.fn().mockRejectedValue(new Error('blocked')) }],
  ])('copies the link and says so when openInConnectionBrowser %s', async (_label, openers) => {
    const copyToClipboard = vi.fn().mockResolvedValue(undefined);
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { utils: { getCurrentTheme: vi.fn().mockResolvedValue('dark'), ...openers, copyToClipboard, showNotification } });
    await renderSection(formDataConfig());
    const event = await clickDocsLink();
    expect(event.defaultPrevented).toBe(true);
    expect(copyToClipboard).toHaveBeenCalledWith(expect.stringContaining('set-field-values-using-parameters-passed-form'));
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Link copied', body: expect.stringContaining('clipboard'),
    }));
  });

  it('puts the address in the notification when it can neither open nor copy the link', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    vi.stubGlobal('toolboxAPI', { utils: { getCurrentTheme: vi.fn().mockResolvedValue('dark'), showNotification } });
    await renderSection(formDataConfig());
    await clickDocsLink();
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Could not open link',
      body: expect.stringContaining('set-field-values-using-parameters-passed-form'),
    }));
  });
});

describe('DestinationSection — unconfirmed environment (r2 WR-003)', () => {
  const restored = cfg({
    trigger: { kind: 'FormButton' }, host: { entityName: 'account' },
    context: { source: { kind: 'lookup', attribute: 'primarycontactid' } },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', tabName: 'general', data: '', createNew: false },
  });
  const lookupService = () => ({
    ...makeMetadataService(),
    listLookupAttributes: vi.fn().mockResolvedValue([{ LogicalName: 'primarycontactid', Targets: ['lead'] }]),
  }) as unknown as MetadataService;
  const settle = async () => {
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
  };

  it('leaves the restored destination alone until the environment is confirmed', async () => {
    const onChange = vi.fn();
    await render(<DestinationSection config={restored} onChange={onChange} metadataService={lookupService()}
      formXmlService={formXmlService} errors={{}} warnings={{}} orgMismatch />);
    await settle();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('re-resolves the lookup once the environment is confirmed', async () => {
    const onChange = vi.fn();
    await render(<DestinationSection config={restored} onChange={onChange} metadataService={lookupService()}
      formXmlService={formXmlService} errors={{}} warnings={{}} />);
    await settle();
    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0] as Updater;
    expect(updater(restored).target).toMatchObject({ entityName: 'lead', formId: '', tabName: '' });
  });
});
