import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capGridFetchXml, GridPreview } from '../components/GridPreview';
import { PreviewPanel } from '../components/PreviewPanel';
import { MetadataService } from '../services/MetadataService';
import { cfg, deferred, xrmStub } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
const view = { id: '11111111-1111-1111-1111-111111111111', name: 'Active accounts', viewType: 'savedquery' as const,
  fetchXml: '<fetch><entity name="account"><attribute name="name"/></entity></fetch>' };
const config = cfg({ target: { pageType: 'entitylist', entityName: 'account', viewId: view.id, viewType: view.viewType } });
const validation = { isValid: true, errors: [], warnings: [] };
function metadata() {
  return { listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [view] }),
    listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }), invalidate: vi.fn() } as unknown as MetadataService;
}
async function render(element: React.ReactElement) {
  if (!root) { host = document.createElement('div'); document.body.append(host); root = createRoot(host); }
  await act(async () => { root!.render(element); });
}
async function click(text: string) {
  const button = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === text);
  expect(button, text).toBeTruthy();
  await act(async () => { button!.click(); });
}
function preview(service = metadata(), key = 'account') {
  return <GridPreview key={key} config={config} validation={validation} metadataService={service}
    entityName="account" allowEntityChange={false} onEntityNameChange={() => undefined} />;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove(); root = undefined; host = undefined; vi.unstubAllGlobals();
});

describe('grid preview', () => {
  it('caps the root while preserving filters, joins, ordering and smaller limits', () => {
    const xml = '<?xml version="1.0"?><fetch top="25" count="200" page="2" paging-cookie="cookie" returntotalrecordcount="true"><entity name="account"><filter><condition attribute="name" operator="eq" value="A &amp; B"/></filter><order attribute="name"/><link-entity name="contact" from="parentcustomerid" to="accountid" alias="c"/></entity></fetch>';
    const doc = new DOMParser().parseFromString(capGridFetchXml(xml, 'account'), 'text/xml');
    expect(doc.documentElement.getAttribute('top')).toBe('10');
    for (const key of ['count', 'page', 'paging-cookie', 'returntotalrecordcount']) expect(doc.documentElement.hasAttribute(key)).toBe(false);
    expect(doc.querySelector('condition')?.getAttribute('value')).toBe('A & B');
    expect(doc.querySelector('link-entity')?.getAttribute('alias')).toBe('c');
    expect(doc.querySelector('order')?.getAttribute('attribute')).toBe('name');
    expect(capGridFetchXml('<fetch top="3"><entity name="account"/></fetch>', 'account')).toContain('top="3"');
    for (const bad of ['<fetch>', '<fetch top="oops"><entity name="account"/></fetch>', '<fetch><entity name="contact"/></fetch>', '<!DOCTYPE fetch><fetch><entity name="account"/></fetch>']) {
      expect(() => capGridFetchXml(bad, 'account')).toThrow();
    }
  });

  it('reads only on Generate, caps displayed rows, uses annotations, and simulates selection', async () => {
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: Array.from({ length: 12 }, (_, i) => ({ name: `Acme ${i}`, statuscode: 1,
      'statuscode@OData.Community.Display.V1.FormattedValue': 'Active', '@odata.etag': 'secret' })) });
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    await render(preview());
    expect(fetchXmlQuery).not.toHaveBeenCalled();
    await click('Generate grid preview');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(1);
    expect(fetchXmlQuery.mock.calls[0][0]).toContain('top="10"');
    expect(host!.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(host!.textContent).toContain('Active');
    expect(host!.textContent).toContain('Acme 0');
    expect(host!.textContent).not.toContain('secret');
    expect(host!.textContent).not.toContain('SelectedRow:');
    await click('Preview command for row 2');
    expect(host!.textContent).toContain('SelectedRow: row 2');
    expect(host!.textContent).toContain(config.pane.title);
    expect(config.pane.isSelected).toBe(true);
  });

  it('shows empty results and query failures with a repeatable explicit action', async () => {
    const fetchXmlQuery = vi.fn().mockRejectedValueOnce(new Error('Access denied')).mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    await render(preview());
    await click('Generate grid preview');
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain('Access denied');
    await click('Generate grid preview');
    expect(host!.textContent).toContain('No rows returned.');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(2);
  });

  it('does not issue a data read when metadata lookup fails or the view disappeared', async () => {
    const listViewsForEntity = vi.fn().mockResolvedValue({ status: 'ok', views: [view] });
    const service = { ...metadata(), listViewsForEntity } as unknown as MetadataService;
    const fetchXmlQuery = vi.fn();
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    await render(preview(service));
    listViewsForEntity.mockResolvedValueOnce({ status: 'error', reason: 'Views unavailable' });
    await click('Generate grid preview');
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain('Views unavailable');
    listViewsForEntity.mockResolvedValueOnce({ status: 'ok', views: [] });
    await click('Generate grid preview');
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain('Select an accessible view.');
    expect(fetchXmlQuery).not.toHaveBeenCalled();
  });

  it('discards pending reads when the preview selection is replaced', async () => {
    const pending = deferred<{ value: Record<string, unknown>[] }>();
    const fetchXmlQuery = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    const service = metadata();
    await render(preview(service, 'old'));
    await click('Generate grid preview');
    await render(preview(service, 'new'));
    await act(async () => { pending.resolve({ value: [{ name: 'Stale row' }] }); });
    expect(host!.textContent).not.toContain('Stale row');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(1);
  });

  it('uses the configured entity and view after switching from a custom target', async () => {
    const listViewsForEntity = vi.fn().mockResolvedValue({ status: 'ok', views: [view] });
    const service = { ...metadata(), listViewsForEntity } as unknown as MetadataService;
    const xrm = xrmStub();
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    const panel = (value: ReturnType<typeof cfg>) => <PreviewPanel config={value} validation={validation} metadataService={service} xrm={xrm} />;
    await render(panel(cfg()));
    await render(panel(config));
    await click('Grid');
    expect(host!.textContent).toContain('Preview entity: account');
    const generate = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Generate grid preview');
    expect(generate?.disabled).toBe(false);
    expect(listViewsForEntity).toHaveBeenCalledWith('account');
    expect(fetchXmlQuery).not.toHaveBeenCalled();
    await click('Generate grid preview');
    expect(fetchXmlQuery.mock.calls[0][0]).toContain('name="account"');
  });

  it('offers the local entity picker when a grid trigger target has no entity', async () => {
    const listAccessibleTables = vi.fn().mockResolvedValue({ status: 'ok', tables: [] });
    const service = { ...metadata(), listAccessibleTables } as unknown as MetadataService;
    listAccessibleTables.mockResolvedValue({ status: 'ok', tables: [
      { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
    ] });
    const fetchXmlQuery = vi.fn();
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    await render(<PreviewPanel config={cfg({ trigger: { ...config.trigger, kind: 'MainGridButton' } })}
      validation={validation} metadataService={service} xrm={xrmStub()} />);
    await click('Grid');
    const entityLabel = Array.from(host!.querySelectorAll('label')).find(label => label.textContent?.startsWith('Preview entity'));
    const entitySelect = entityLabel?.querySelector('select');
    expect(entitySelect).toBeTruthy();
    await act(async () => {
      entitySelect!.value = 'account';
      entitySelect!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const viewOption = Array.from(host!.querySelectorAll('option')).find(option => option.textContent?.includes(view.name));
    expect(viewOption).toBeTruthy();
    await act(async () => {
      const select = viewOption!.closest('select')!;
      select.value = viewOption!.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const generate = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Generate grid preview');
    expect(generate?.disabled).toBe(false);
    expect(fetchXmlQuery).not.toHaveBeenCalled();
  });

  it('gates the Grid tab by target or grid trigger and clears it when eligibility changes', async () => {
    const service = metadata();
    const xrm = xrmStub();
    const panel = (value: ReturnType<typeof cfg>) => <PreviewPanel config={value} validation={validation} metadataService={service} xrm={xrm} />;
    await render(panel(cfg()));
    expect(Array.from(host!.querySelectorAll('button')).some(b => b.textContent === 'Grid')).toBe(false);
    await render(panel(config));
    await click('Grid');
    expect(host!.textContent).toContain('Generate grid preview');
    await render(panel(cfg()));
    expect(host!.textContent).not.toContain('Generate grid preview');
    for (const kind of ['MainGridButton', 'SubgridButton'] as const) {
      await render(panel(cfg({ trigger: { ...config.trigger, kind } })));
      expect(Array.from(host!.querySelectorAll('button')).some(b => b.textContent === 'Grid')).toBe(true);
    }
  });
});