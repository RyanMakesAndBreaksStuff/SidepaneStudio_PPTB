import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigurePanel } from '../components/ConfigurePanel';
import { capGridFetchXml, GridPreview } from '../components/GridPreview';
import { PreviewPanel } from '../components/PreviewPanel';
import { PreviewSessionProvider } from '../contexts/PreviewSessionContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { MetadataService, type LookupAttributeInfo } from '../services/MetadataService';
import { validate } from '../services/ValidationService';
import { gridCellText, relatedRecordOf, resolveGridColumns } from '../services/GridViewModel';
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import { cfg, deferred, xrmStub } from './testHelpers';

let xrm = xrmStub();
function setFetch(fn: unknown) { xrm = { ...xrmStub(), fetchXml: fn as IXrmContext['fetchXml'] }; }
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
    listLookupAttributes: vi.fn().mockResolvedValue([
      { LogicalName: 'primarycontactid', Targets: ['contact'], DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } } },
    ]),
    listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
    listAttributeLabels: vi.fn().mockImplementation(async (entity: string) => entity === 'account' ? [
      { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Account Name' } } },
      { LogicalName: 'statuscode', DisplayName: { UserLocalizedLabel: { Label: 'Status Reason' } } },
      { LogicalName: 'primarycontactid', DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } } },
    ] : [
      { LogicalName: 'emailaddress1', DisplayName: { UserLocalizedLabel: { Label: 'Email' } } },
    ]),
    invalidate: vi.fn(),
    subscribeTables: vi.fn(() => () => undefined) } as unknown as MetadataService;
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
async function chooseTable(input: HTMLInputElement, logicalName: string) {
  await act(async () => { input.focus(); input.click(); });
  const option = Array.from(host!.querySelectorAll<HTMLElement>('[role="option"]'))
    .find(item => item.textContent?.includes(logicalName));
  expect(option, logicalName).toBeTruthy();
  await act(async () => { option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
}
function preview(service = metadata(), key = 'account') {
  return <GridPreview key={key} config={config} validation={validation} metadataService={service} xrm={xrm}
    entityName="account" allowEntityChange={false} onEntityNameChange={() => undefined} />;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove(); root = undefined; host = undefined; xrm = xrmStub(); vi.unstubAllGlobals();
});
describe('grid preview', () => {
  it('preserves a valid row table annotation in the shared Form preview record representation', () => {
    expect(relatedRecordOf({ _customerid_value: 'customer-id',
      '_customerid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
      '_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'contact' }, 'customerid'))
      .toEqual({ id: 'customer-id', name: 'Pat Lee', entityName: 'contact' });
  });

  it('uses layout display labels and excludes incidental record keys', async () => {
    setFetch(vi.fn().mockResolvedValue({ value: [{
      accountid: 'record-id', name: 'Acme', statuscode: 1,
      'statuscode@OData.Community.Display.V1.FormattedValue': 'Active',
      _primarycontactid_value: 'contact-id',
      '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
      'c.emailaddress1': 'pat@example.com',
    }] }));
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
    setFetch(fetchXmlQuery);
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
    setFetch(fetchXmlQuery);
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
    setFetch(vi.fn().mockResolvedValue({ value: [{ name: 'Acme' }, { name: 'Beta' }] }));
    await render(<GridPreview config={{ ...config, trigger: { ...config.trigger, kind } }} validation={validation}
      metadataService={metadata()} xrm={xrm} entityName="account" allowEntityChange={false} onEntityNameChange={() => undefined} />);
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 2"]')!.click(); });
    expect(host!.textContent).toContain('SelectedRow: row 2');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).not.toContain('SelectedRow:');
  });

  it('shows empty results and query failures with a repeatable explicit action', async () => {
    const fetchXmlQuery = vi.fn().mockRejectedValueOnce(new Error('Access denied')).mockResolvedValue({ value: [] });
    setFetch(fetchXmlQuery);
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
    setFetch(fetchXmlQuery);
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
    setFetch(fetchXmlQuery);
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
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [] });
    setFetch(fetchXmlQuery);
    const panel = (value: ReturnType<typeof cfg>) => <PreviewPanel config={value} validation={validation} metadataService={service} xrm={xrm} />;
    await render(panel(cfg()));
    await render(panel(config));
    await click('Grid');
    expect(host!.querySelector('[role="group"][aria-label="Preview entity"]')).toBeTruthy();
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
    setFetch(fetchXmlQuery);
    await render(<PreviewPanel config={cfg({ trigger: { ...config.trigger, kind: 'MainGridButton' } })}
      validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    const entityGroup = host!.querySelector('[role="group"][aria-label="Preview entity"]');
    const entityInput = entityGroup?.querySelector<HTMLInputElement>('[role="combobox"]');
    expect(entityInput).toBeTruthy();
    await chooseTable(entityInput!, 'account');
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
    setFetch(fetchXmlQuery);
    await render(<PreviewPanel config={config} validation={validation} metadataService={metadata()} xrm={xrm} />);
    await click('Grid');
    await click('Generate grid preview');
    await click('Mock');
    await click('Grid');
    expect(host!.textContent).toContain('Keep me');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(1);
  });

  it('restores the grid after panel unmount and clears it for a new session', async () => {
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [{ name: 'Session row' }] });
    setFetch(fetchXmlQuery);
    const service = metadata();
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

  it('adds a RelatedRecord lookup column once, and never beside all-attributes', () => {
    const attributes = (xml: string) => Array.from(new DOMParser().parseFromString(xml, 'text/xml')
      .querySelectorAll('entity > attribute')).map(a => a.getAttribute('name'));
    expect(attributes(capGridFetchXml('<fetch><entity name="account"><attribute name="name"/></entity></fetch>', 'account', 'primarycontactid')))
      .toEqual(['name', 'primarycontactid']);
    expect(attributes(capGridFetchXml('<fetch><entity name="account"><attribute name="primarycontactid"/></entity></fetch>', 'account', 'primarycontactid')))
      .toEqual(['primarycontactid']);
    expect(capGridFetchXml('<fetch><entity name="account"><all-attributes/></entity></fetch>', 'account', 'primarycontactid'))
      .not.toContain('<attribute');
  });

  it('previews RelatedRecord on the source table and opens the selected row lookup record', async () => {
    const nameOnly = { ...view,
      fetchXml: '<fetch><entity name="account"><attribute name="name"/></entity></fetch>',
      layoutXml: '<grid jump="name"><row id="accountid"><cell name="name" width="240"/></row></grid>',
    };
    const service = { ...metadata(), listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [nameOnly] }),
      listLookupAttributes: vi.fn().mockResolvedValue([
        { LogicalName: 'primarycontactid', Targets: ['contact'], DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } } },
      ]) } as unknown as MetadataService;
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [
      { name: 'Acme', _primarycontactid_value: 'contact-id', '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee' },
      { name: 'Beta', _primarycontactid_value: null },
    ] });
    setFetch(fetchXmlQuery);
    const related = cfg({
      trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' },
    });
    await render(<PreviewPanel config={related} validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    expect(host!.querySelector('[role="group"][aria-label="Related record source"]')).toBeTruthy();
    const viewSelect = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => {
      viewSelect.value = `savedquery:${nameOnly.id}`;
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click('Generate grid preview');
    expect(fetchXmlQuery.mock.calls[0][0]).toContain('name="primarycontactid"');
    const row = (n: number) => host!.querySelector<HTMLInputElement>(`input[aria-label="Select row ${n}"]`)!;
    await act(async () => { row(1).click(); });
    expect(host!.textContent).toContain('Pat Lee · contact-id');
    await act(async () => { row(1).click(); });
    await act(async () => { row(2).click(); });
    expect(host!.textContent).toContain('No primarycontactid value on row 2, so the pane does not open.');
    expect(host!.textContent).not.toContain(related.pane.title);
  });

  it.each([
    ['account', 'account'],
    ['contact', 'contact'],
  ])('labels the related pane from the row table annotation: %s', async (logicalName, label) => {
    const service = { ...metadata(), listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [view] }),
      listLookupAttributes: vi.fn().mockResolvedValue([{ LogicalName: 'customerid', Targets: ['account', 'contact'] }]) } as unknown as MetadataService;
    setFetch(vi.fn().mockResolvedValue({ value: [{ name: 'Fabrikam', _customerid_value: 'customer-id',
      '_customerid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
      '_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname': logicalName }] }));
    const related = cfg({ trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'customerid' } });
    await render(<PreviewPanel config={related} validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    const viewSelect = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => { viewSelect.value = `savedquery:${view.id}`; viewSelect.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    const record = host!.querySelector('[title="customer-id"]');
    expect(record?.textContent).toContain('Pat Lee · customer-id');
    expect(record?.previousElementSibling?.textContent?.trim()).toBe(label);
  });

  it('uses a single confirmed lookup target when the row has no table annotation', async () => {
    const service = { ...metadata(), listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [view] }),
      listLookupAttributes: vi.fn().mockResolvedValue([{ LogicalName: 'customerid', Targets: ['contact'],
        DisplayName: { UserLocalizedLabel: { Label: 'Customer' } } }]) } as unknown as MetadataService;
    setFetch(vi.fn().mockResolvedValue({ value: [{ name: 'Fabrikam', _customerid_value: 'customer-id',
      '_customerid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee' }] }));
    const related = cfg({ trigger: { kind: 'MainGridOnSelect' }, target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'customerid' } });
    await render(<PreviewPanel config={related} validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    const viewSelect = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => { viewSelect.value = `savedquery:${view.id}`; viewSelect.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    const record = host!.querySelector('[title="customer-id"]');
    expect(record?.previousElementSibling?.textContent?.trim()).toBe('contact');
  });

  it('keeps a multi-target lookup unresolved and the pane closed when its table annotation is missing', async () => {
    const service = { ...metadata(), listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [view] }),
      listLookupAttributes: vi.fn().mockResolvedValue([{ LogicalName: 'customerid', Targets: ['account', 'contact'] }]) } as unknown as MetadataService;
    setFetch(vi.fn().mockResolvedValue({ value: [{ name: 'Fabrikam', _customerid_value: 'customer-id' }] }));
    const related = cfg({ trigger: { kind: 'MainGridOnSelect' }, target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'customerid' } });
    await render(<PreviewPanel config={related} validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    const viewSelect = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => { viewSelect.value = `savedquery:${view.id}`; viewSelect.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).toContain("The related record's table could not be determined");
    expect(host!.querySelector('[title="customer-id"]')).toBeNull();
  });

  it.each(['account', 'account-bad'])('reports an invalid or out-of-Targets annotation as an explicit error and keeps the pane closed: %s', async annotation => {
    const service = { ...metadata(), listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [view] }),
      listLookupAttributes: vi.fn().mockResolvedValue([{ LogicalName: 'customerid', Targets: ['contact'] }]) } as unknown as MetadataService;
    setFetch(vi.fn().mockResolvedValue({ value: [{ name: 'Fabrikam', _customerid_value: 'customer-id',
      '_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname': annotation }] }));
    const related = cfg({ trigger: { kind: 'MainGridOnSelect' }, target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'customerid' } });
    await render(<PreviewPanel config={related} validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    const viewSelect = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => { viewSelect.value = `savedquery:${view.id}`; viewSelect.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).toContain('not an allowed destination table');
    expect(host!.querySelector('[title="customer-id"]')).toBeNull();
  });

  it('distinguishes an empty lookup from an unresolved populated lookup', async () => {
    const service = { ...metadata(), listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [view] }),
      listLookupAttributes: vi.fn().mockResolvedValue([{ LogicalName: 'customerid', Targets: ['contact', 'account'] }]) } as unknown as MetadataService;
    setFetch(vi.fn().mockResolvedValue({ value: [{ name: 'No customer', _customerid_value: null }] }));
    const related = cfg({ trigger: { kind: 'MainGridOnSelect' }, target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'customerid' } });
    await render(<PreviewPanel config={related} validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    const viewSelect = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => { viewSelect.value = `savedquery:${view.id}`; viewSelect.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).toContain('No customerid value on row 1');
    expect(host!.textContent).not.toContain("The related record's table could not be determined");
    expect(host!.querySelector('[title="customer-id"]')).toBeNull();
  });

  it('keeps a destination entity-list view out of the RelatedRecord source view picker', async () => {
    const service = metadata();
    const related = cfg({
      target: { pageType: 'entitylist', entityName: 'contact', viewId: 'destination-view', viewType: 'savedquery' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' },
    });
    await render(<PreviewPanel config={related} validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    const sourceView = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    expect(sourceView.value).toBe('');
    expect(Array.from(sourceView.options).some(option => option.textContent === 'Configured view (unavailable)')).toBe(false);
    const listViewsForEntityMock = Reflect.get(service, 'listViewsForEntity') as ReturnType<typeof vi.fn>;
    expect(listViewsForEntityMock).toHaveBeenCalledWith('account');
  });

  it('disables Generate while the selected RelatedRecord view is loading, failed, or unavailable', async () => {
    const related = cfg({ trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' } });
    const panel = (service: MetadataService) => <PreviewPanel config={related} validation={validation} metadataService={service} xrm={xrm} />;
    const available = metadata();
    const failed = { ...metadata(), listViewsForEntity: vi.fn().mockResolvedValue({ status: 'error', reason: 'Views unavailable' }) } as unknown as MetadataService;
    const unavailable = { ...metadata(), listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }) } as unknown as MetadataService;
    await render(panel(available));
    await click('Grid');
    const viewPicker = () => host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => {
      viewPicker().value = `savedquery:${view.id}`;
      viewPicker().dispatchEvent(new Event('change', { bubbles: true }));
    });
    const generate = () => Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!;
    expect(generate().disabled).toBe(false);

    await render(panel(failed));
    expect(generate().disabled).toBe(true);
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain('Views unavailable');

    await render(panel(unavailable));
    expect(viewPicker().selectedOptions[0].textContent).toBe('Configured view (unavailable)');
    expect(generate().disabled).toBe(true);
  });
});

describe('related-record lookup metadata remounts', () => {
  it('preserves generated rows and the selected related record when returning to Grid with unchanged metadata', async () => {
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [{
      name: 'Fabrikam',
      _primarycontactid_value: 'contact-id',
      '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
      '_primarycontactid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'contact',
    }] });
    setFetch(fetchXmlQuery);
    const service = {
      ...metadata(),
      listLookupAttributes: vi.fn().mockResolvedValue([
        { LogicalName: 'primarycontactid', Targets: ['contact'] },
      ]),
    } as unknown as MetadataService;
    const relatedConfig = cfg({
      trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' },
    });
    await render(<PreviewPanel config={relatedConfig} validation={validation} metadataService={service} xrm={xrm} />);
    await click('Grid');
    const viewSelect = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => {
      viewSelect.value = `savedquery:${view.id}`;
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click('Generate grid preview');
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).toContain('Pat Lee');

    await click('Mock');
    await click('Grid');
    await act(async () => { await Promise.resolve(); });

    expect(host!.textContent).toContain('Fabrikam');
    expect(host!.textContent).toContain('Pat Lee');
    expect(fetchXmlQuery).toHaveBeenCalledTimes(1);
  });
});
describe('related-record cross-component transitions', () => {
  it('does not change the related source or custom-only state when the Source table label is clicked', async () => {
    const relatedConfig = cfg({
      context: { mode: 'RelatedRecord', entityName: 'new_event', lookupAttribute: '' },
    });
    const service = {
      ...metadata(),
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
        { logicalName: 'account', displayName: 'Account', objectTypeCode: 1, isCustomEntity: false },
        { logicalName: 'new_event', displayName: 'Event', objectTypeCode: 10001, isCustomEntity: true },
      ] }),
    } as unknown as MetadataService;
    await render(<GridPreview config={relatedConfig} validation={validation} metadataService={service} xrm={xrm}
      entityName="new_event" allowEntityChange={false} onEntityNameChange={() => undefined} />);

    const sourceLabel = Array.from(host!.querySelectorAll('label'))
      .find(label => label.textContent?.startsWith('Source table'))!;
    await act(async () => { sourceLabel.click(); });

    expect(Array.from(host!.querySelectorAll<HTMLElement>('[role="option"]'))
      .some(option => option.textContent?.includes('new_event') && option.getAttribute('aria-selected') === 'true')).toBe(true);
    expect(Array.from(host!.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.getAttribute('aria-label') === 'Show custom tables only')?.getAttribute('aria-pressed')).toBe('false');
  });


  const tables = [
    { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
    { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
  ];
  const accountView = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Active Accounts',
    viewType: 'savedquery' as const,
    fetchXml: '<fetch><entity name="account"><attribute name="name"/></entity></fetch>',
    layoutXml: '<grid jump="name"><row id="accountid"><cell name="name" width="240"/></row></grid>',
  };
  function workflowService(overrides: Partial<MetadataService> = {}): MetadataService {
    return {
      ...metadata(),
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables }),
      listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [accountView] }),
      listLookupAttributes: vi.fn().mockImplementation(async (entity: string) => entity === 'account'
        ? [
          { LogicalName: 'primarycontactid', Targets: ['contact'], DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } } },
          { LogicalName: 'customerid', Targets: ['account', 'contact'], DisplayName: { UserLocalizedLabel: { Label: 'Customer' } } },
        ]
        : [{ LogicalName: 'parentcustomerid', Targets: ['account'], DisplayName: { UserLocalizedLabel: { Label: 'Parent Customer' } } }]),
      ...overrides,
    } as unknown as MetadataService;
  }
  function surface(name: string): HTMLElement {
    const node = host!.querySelector(`[data-surface="${name}"]`);
    expect(node, name).toBeTruthy();
    return node as HTMLElement;
  }
  async function expand(rootNode: ParentNode, title: string) {
    const button = Array.from(rootNode.querySelectorAll('button')).find(item => item.textContent?.includes(title));
    expect(button, title).toBeTruthy();
    if (button!.getAttribute('aria-expanded') === 'false') {
      await act(async () => { button!.click(); });
    }
  }
  async function openGrid() {
    const button = Array.from(surface('preview').querySelectorAll('button')).find(item => item.textContent === 'Grid');
    expect(button, 'Grid').toBeTruthy();
    await act(async () => { button!.click(); });
  }

  it('carries a Configure lookup into Grid and clears both surfaces when the Grid source changes', async () => {
    setFetch(vi.fn().mockResolvedValue({ value: [
      { name: 'Fabrikam', _primarycontactid_value: 'contact-id', '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee', '_primarycontactid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'contact' },
    ] }));
    const initial = cfg({
      trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: 'old-form', tabName: 'old-tab', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: '' },
    });
    const service = workflowService();
    function Workflow(): React.ReactElement {
      const [config, setConfig] = React.useState(initial);
      const targetState = config.target.pageType === 'entityrecord'
        ? `${config.target.entityName}|${config.target.formId}|${config.target.tabName}` : '';
      return <>
        <output aria-label="shared config">{config.context.entityName}|{config.context.lookupAttribute}|{targetState}</output>
        <div data-surface="configure">
          <ConfigurePanel config={config} onChange={updater => setConfig(prev => updater(prev))} validation={validate(config)} metadataService={service} />
        </div>
        <div data-surface="preview">
          <PreviewPanel config={config} onChange={updater => setConfig(prev => updater(prev))} validation={validate(config)} metadataService={service} xrm={xrm} />
        </div>
      </>;
    }
    await render(<ThemeProvider><Workflow /></ThemeProvider>);
    const configure = surface('configure');
    await expand(configure, 'Record context');
    const lookup = configure.querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')!;
    expect(Array.from(lookup.options).map(option => option.textContent)).toContain('Primary Contact (primarycontactid)');
    await act(async () => {
      lookup.value = 'primarycontactid';
      lookup.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expand(configure, 'What opens in the pane');
    expect(configure.textContent).toContain('Destination table: contact');
    expect(host!.querySelector('[aria-label="shared config"]')?.textContent).toBe('account|primarycontactid|contact||');
    const tabField = Array.from(configure.querySelectorAll('label')).find(label => label.textContent?.includes('Tab name'))?.parentElement;
    expect(tabField?.querySelector('input')?.value).toBe('');
    expect(tabField?.querySelector('input')?.disabled).toBe(false);

    await openGrid();
    const preview = surface('preview');
    const gridLookup = preview.querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')!;
    expect(gridLookup.value).toBe('primarycontactid');
    expect(preview.textContent).toContain('Destination table: contact');
    const viewSelect = preview.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => {
      viewSelect.value = `savedquery:${accountView.id}`;
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const generate = Array.from(preview.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!;
    expect(generate.disabled).toBe(false);
    await act(async () => { generate.click(); });
    await act(async () => { preview.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(preview.textContent).toContain('Pat Lee');
    expect(preview.querySelector('[title="contact-id"]')?.previousElementSibling?.textContent?.trim()).toBe('contact');

    const source = preview.querySelector<HTMLInputElement>('[aria-label="Source table"]')!;
    await chooseTable(source, 'contact');
    expect(host!.querySelector('[aria-label="shared config"]')?.textContent).toBe('contact||||');
    expect(configure.querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')!.value).toBe('');
    expect(configure.textContent).not.toContain('Destination table: contact');
    expect(preview.textContent).not.toContain('Pat Lee');

    const mockTab = Array.from(preview.querySelectorAll('button')).find(button => button.textContent === 'Mock')!;
    const gridTab = Array.from(preview.querySelectorAll('button')).find(button => button.textContent === 'Grid')!;
    await act(async () => { mockTab.click(); });
    await act(async () => { gridTab.click(); });
    expect(surface('preview').textContent).not.toContain('Pat Lee');
    expect(surface('preview').querySelector('input[aria-label="Select row 1"]')).toBeNull();
  });

  it('keeps a polymorphic customer lookup consistent after a replaced metadata service', async () => {
    const oldLookupMetadata = deferred<LookupAttributeInfo[]>();
    const oldService = workflowService({
      listLookupAttributes: vi.fn(() => oldLookupMetadata.promise),
    });
    const newService = workflowService();
    setFetch(vi.fn().mockResolvedValue({ value: [{
      name: 'Fabrikam', _customerid_value: 'customer-id',
      '_customerid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
      '_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'contact',
    }] }));
    const initial = cfg({
      trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: 'saved-form', tabName: 'saved-tab', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'customerid' },
    });
    function Workflow({ service }: { service: MetadataService }): React.ReactElement {
      const [config, setConfig] = React.useState(initial);
      return <>
        <div data-surface="configure">
          <ConfigurePanel config={config} onChange={updater => setConfig(prev => updater(prev))} validation={validate(config)} metadataService={service} />
        </div>
        <div data-surface="preview">
          <PreviewPanel config={config} onChange={updater => setConfig(prev => updater(prev))} validation={validate(config)} metadataService={service} xrm={xrm} />
        </div>
      </>;
    }
    await render(<ThemeProvider><Workflow service={oldService} /></ThemeProvider>);
    await expand(surface('configure'), 'Record context');
    expect(surface('configure').textContent).toContain('Loading lookup columns');
    await openGrid();
    expect(surface('preview').textContent).toContain('Loading lookup columns');
    await act(async () => {
      root!.render(<ThemeProvider><Workflow service={newService} /></ThemeProvider>);
    });
    oldLookupMetadata.resolve([{ LogicalName: 'staleaccountlookup', Targets: ['account'] }]);
    await act(async () => { await Promise.resolve(); });
    expect(host!.textContent).not.toContain('staleaccountlookup');
    expect(surface('configure').querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')?.value).toBe('customerid');
    expect(surface('preview').querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')?.value).toBe('customerid');
    await expand(surface('configure'), 'What opens in the pane');
    expect(surface('configure').textContent).toContain('Possible destination tables: account, contact.');
    expect(surface('configure').textContent).toContain('Determined by the selected row');
    const tabField = Array.from(surface('configure').querySelectorAll('label')).find(label => label.textContent?.includes('Tab name'))?.parentElement;
    expect(tabField?.querySelector('input')?.disabled).toBe(true);
    const preview = surface('preview');
    expect(preview.textContent).toContain('Possible destination tables: account, contact.');
    const viewSelect = preview.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => {
      viewSelect.value = `savedquery:${accountView.id}`;
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const generate = Array.from(preview.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!;
    expect(generate.disabled).toBe(false);
    await act(async () => { generate.click(); });
    await act(async () => { preview.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(preview.querySelector('[title="customer-id"]')?.previousElementSibling?.textContent?.trim()).toBe('contact');
  });
});
