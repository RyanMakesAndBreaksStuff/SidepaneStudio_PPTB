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
      { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
      { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
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
