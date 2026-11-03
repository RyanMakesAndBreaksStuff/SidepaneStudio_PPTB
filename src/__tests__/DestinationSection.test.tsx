import * as React from 'react';
import { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const formXmlService = { getFormsForEntityResult: vi.fn().mockResolvedValue({ ok: true, forms: [] }) } as unknown as FormXmlService;

async function render(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<ThemeProvider>{element}</ThemeProvider>); });
}

/** Renders the section against live state, the way the workbench coerces every change. */
async function renderSection(initial: PaneDefinitionConfig): Promise<() => PaneDefinitionConfig> {
  let current = initial;
  function Harness(): React.ReactElement {
    const [config, setConfig] = useState(initial);
    current = config;
    return <DestinationSection config={config} onChange={updater => setConfig(prev => coerceConfig(updater(prev)))}
      metadataService={makeMetadataService()} formXmlService={formXmlService} errors={{}} warnings={{}} />;
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
