import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capGridFetchXml, GridPreview } from '../components/GridPreview';
import { PreviewPanel } from '../components/PreviewPanel';
import { PreviewSessionProvider } from '../contexts/PreviewSessionContext';
import { MetadataService } from '../services/MetadataService';
import { gridCellText, resolveGridColumns } from '../services/GridViewModel';
import { cfg, deferred, xrmStub } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
const view = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Active accounts', viewType: 'savedquery' as const,
  fetchXml: '<fetch><entity name="account"><attribute name="name"/><attribute name="statuscode"/><attribute name="primarycontactid"/><link-entity name="contact" alias="c" from="contactid" to="primarycontactid"><attribute name="emailaddress1"/></link-entity></entity></fetch>',
  layoutXml: '<grid jump="name"><row id="accountid"><cell name="name" width="240"/><cell name="statuscode" width="100"/><cell name="primarycontactid" width="180"/><cell name="c.emailaddress1" width="200"/></row></grid>',
};
const config = cfg({ target: { pageType: 'entitylist', entityName: 'account', viewId: view.id, viewType: view.viewType } });
const validation = { isValid: true, errors: [], warnings: [] };
function metadata() {
  return { listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [view] }),
    listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
    listAttributeLabels: vi.fn().mockImplementation(async (entity: string) => entity === 'account' ? [
      { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Account Name' } } },
      { LogicalName: 'statuscode', DisplayName: { UserLocalizedLabel: { Label: 'Status Reason' } } },
      { LogicalName: 'primarycontactid', DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } } },
    ] : [
      { LogicalName: 'emailaddress1', DisplayName: { UserLocalizedLabel: { Label: 'Email' } } },
    ]),
    invalidate: vi.fn() } as unknown as MetadataService;
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
  it('uses layout display labels and excludes incidental record keys', async () => {
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery: vi.fn().mockResolvedValue({ value: [{
      accountid: 'record-id', name: 'Acme', statuscode: 1,
      'statuscode@OData.Community.Display.V1.FormattedValue': 'Active',
      _primarycontactid_value: 'contact-id',
      '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
      'c.emailaddress1': 'pat@example.com',
    }] }) });
    await render(preview());
    await click('Generate grid preview');
    expect(Array.from(host!.querySelectorAll('thead th')).slice(1).map(th => th.textContent))
      .toEqual(['Account Name', 'Status Reason', 'Primary Contact', 'Email']);
    expect(host!.textContent).toContain('Pat Lee');
    expect(host!.textContent).toContain('pat@example.com');
    expect(host!.textContent).not.toContain('record-id');
    expect(host!.textContent).not.toContain('contact-id');
  });

  it('resolves empty grids and rejects missing labels or broken layouts without raw-name fallback', async () => {
    const service = metadata();
    const columns = await resolveGridColumns(view, 'account', service);
    expect(columns.map(c => c.width)).toEqual([240, 100, 180, 200]);
    expect(gridCellText({}, columns[0])).toBe('');
    expect(gridCellText({ name: null }, columns[0])).toBe('');
    expect(columns[0].primary).toBe(true);
    await expect(resolveGridColumns({ ...view, layoutXml: '<grid>' }, 'account', service)).rejects.toThrow();
    await expect(resolveGridColumns({ ...view, layoutXml: '<grid><row><cell name="unknown"/></row></grid>' }, 'account', service)).rejects.toThrow();
    await expect(resolveGridColumns(view, 'account', { listAttributeLabels: async () => [] })).rejects.toThrow('Display labels');
    const aliasView = { ...view,
      fetchXml: '<fetch><entity name="account"><attribute name="name" alias="caption"/></entity></fetch>',
      layoutXml: '<grid><row><cell name="caption"/></row></grid>',
    };
    const aliasColumns = await resolveGridColumns(aliasView, 'account', service);
    expect(aliasColumns[0].label).toBe('Account Name');
    expect(gridCellText({ caption: 'Aliased' }, aliasColumns[0])).toBe('Aliased');
  });

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
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 2"]')!.click(); });
    await click('Preview command');
    expect(host!.textContent).toContain('SelectedRow: row 2');
    expect(host!.textContent).toContain(config.pane.title);
    expect(config.pane.isSelected).toBe(true);
  });

  it('uses checkbox selection and an explicit ribbon command without choosing row one', async () => {
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [{ name: 'Acme' }, { name: 'Beta' }] });
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    await render(preview());
    await click('Generate grid preview');
    const command = () => Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Preview command')!;
    expect(command().disabled).toBe(true);
    const boxes = () => Array.from(host!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(boxes()).toHaveLength(3);
    await act(async () => { boxes()[2].click(); });
    expect(boxes()[0].indeterminate).toBe(true);
    expect(command().disabled).toBe(false);
    await click('Preview command');
    expect(host!.textContent).toContain('SelectedRow: row 2');
    await act(async () => { boxes()[0].click(); });
    expect(boxes().every(b => b.checked)).toBe(true);
    expect(command().disabled).toBe(true);
    expect(host!.textContent).not.toContain('SelectedRow:');
    expect(host!.querySelector('[aria-label="Grid commands"]')).toBeTruthy();
    for (const label of ['New', 'Delete', 'Visualize this view', 'Email a Link', 'Flow', 'Run Report', 'Share']) {
      expect(host!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.disabled).toBe(true);
    }
    await click('Refresh');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(2);
    expect(boxes().every(b => !b.checked)).toBe(true);
  });

  it.each(['MainGridOnSelect', 'SubgridOnSelect'] as const)('simulates %s only for one selected row', async kind => {
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery: vi.fn().mockResolvedValue({ value: [{ name: 'Acme' }, { name: 'Beta' }] }) });
    await render(<GridPreview config={{ ...config, trigger: { ...config.trigger, kind } }} validation={validation}
      metadataService={metadata()} entityName="account" allowEntityChange={false} onEntityNameChange={() => undefined} />);
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 2"]')!.click(); });
    expect(host!.textContent).toContain('SelectedRow: row 2');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).not.toContain('SelectedRow:');
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
    const entityGroup = host!.querySelector('[role="group"][aria-label="Preview entity"]');
    const entitySelect = entityGroup?.querySelector('select');
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
    for (const kind of ['MainGridButton', 'SubgridButton', 'MainGridOnSelect', 'SubgridOnSelect'] as const) {
      await render(panel(cfg({ trigger: { ...config.trigger, kind } })));
      expect(Array.from(host!.querySelectorAll('button')).some(b => b.textContent === 'Grid')).toBe(true);
    }
  });

  it('keeps a generated grid when switching to Mock and back', async () => {
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [{ name: 'Keep me' }] });
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    await render(<PreviewPanel config={config} validation={validation} metadataService={metadata()} xrm={xrmStub()} />);
    await click('Grid');
    await click('Generate grid preview');
    await click('Mock');
    await click('Grid');
    expect(host!.textContent).toContain('Keep me');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(1);
  });

  it('restores the grid after panel unmount and clears it for a new session', async () => {
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [{ name: 'Session row' }] });
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    const service = metadata();
    const xrm = xrmStub();
    const panel = (visible: boolean, epoch = 0) => <PreviewSessionProvider key={epoch}>
      {visible && <PreviewPanel config={config} validation={validation} metadataService={service} xrm={xrm} />}
    </PreviewSessionProvider>;
    await render(panel(true));
    await click('Grid');
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    await click('Preview command');
    await render(panel(false));
    await render(panel(true));
    expect(host!.textContent).toContain('Session row');
    expect(host!.textContent).toContain('SelectedRow: row 1');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(1);
    await render(panel(true, 1));
    await click('Grid');
    expect(host!.textContent).not.toContain('Session row');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(1);
  });
});
