import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewPanel } from '../components/PreviewPanel';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { MetadataService } from '../services/MetadataService';
import { DataverseError, type IXrmContext } from '../adapters/PptbContextAdapter';
import { cfg, chooseOption, xrmStub } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(element);
  });
}

async function chooseTable(input: HTMLInputElement, logicalName: string) {
  await act(async () => { await Promise.resolve(); });
  expect(input.disabled).toBe(false);
  await act(async () => { input.focus(); input.click(); });
  const option = Array.from(host!.querySelectorAll<HTMLElement>('[role="option"]'))
    .find(item => item.textContent?.includes(logicalName));
  expect(option, logicalName).toBeTruthy();
  await act(async () => { option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  vi.unstubAllGlobals();
  host?.remove();
  root = undefined;
  host = undefined;
});

const mockMetadataService = {
  listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
  invalidate: vi.fn(),
  subscribeTables: vi.fn(() => () => undefined),
} as unknown as MetadataService;

describe('PreviewPanel', () => {
  it('renders mock preview', async () => {
    await render(
      <PreviewPanel
        config={DEFAULT_CONFIG}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={mockMetadataService}
        xrm={xrmStub()}
      />
    );

    expect(host?.textContent).toContain('Power Apps');
    expect(host?.textContent).toContain('Side Pane Studio');
    expect(host?.textContent).toContain('Summary');
    expect(host?.textContent).toContain('Timeline');
  });

  it('switches to form mode when Form tab is clicked', async () => {
    await render(
      <PreviewPanel
        config={DEFAULT_CONFIG}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={mockMetadataService}
        xrm={xrmStub()}
      />
    );

    const formTab = Array.from(host?.querySelectorAll('button') ?? []).find(
      b => b.textContent === 'Form'
    );
    expect(formTab).toBeTruthy();

    await act(async () => {
      formTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    // In form mode with no entity selected, should show placeholder text
    expect(host?.textContent).toContain('Pick a preview entity');
  });

  it('shows configured entity-record form and tab parameters in preview metadata', async () => {
    await render(
      <PreviewPanel
        config={{
          ...DEFAULT_CONFIG,
          target: {
            pageType: 'entityrecord',
            entityName: 'account',
            formId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            tabName: 'tab_details',
            data: '',
          },
        }}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={mockMetadataService}
        xrm={xrmStub()}
      />
    );

    expect(host?.textContent).toContain('Form: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(host?.textContent).toContain('Tab: tab_details');
  });

  it('shows the configured pane width in Form and Grid modes', async () => {
    const metadataService = {
      ...mockMetadataService,
      listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
    } as unknown as MetadataService;
    await render(
      <PreviewPanel
        config={cfg({ trigger: { kind: 'GridButton' }, pane: { width: 640 } })}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={metadataService}
        xrm={xrmStub()}
      />
    );
    for (const tab of ['Form', 'Grid']) {
      await act(async () => { Array.from(host!.querySelectorAll('button')).find(b => b.textContent === tab)!.click(); });
      expect(host!.textContent, tab).toContain('Width: 640px');
    }
  });

  it('completes the form layout load under StrictMode', async () => {
    const xrm = { ...xrmStub(),
      webApiGet: vi.fn().mockResolvedValue([{ formid: '11111111-2222-3333-4444-555555555555', name: 'Account' }]),
      webApiGetEntity: vi.fn().mockResolvedValue({ formxml: '<form/>' }) };
    await render(
      <React.StrictMode>
        <PreviewPanel
          config={cfg({ host: { entityName: 'account', formId: '11111111-2222-3333-4444-555555555555' } })}
          validation={{ isValid: true, errors: [], warnings: [] }}
          metadataService={new MetadataService(xrm)}
          xrm={xrm}
        />
      </React.StrictMode>
    );
    const formTab = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Form')!;
    await act(async () => { formTab.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(xrm.webApiGetEntity).toHaveBeenCalled();
    expect(host!.textContent).not.toContain('Loading form layout');
  });

  it('loads the host form when host.formId is set and writes form changes back', async () => {
    const formA = '11111111-2222-3333-4444-555555555555';
    const formB = '66666666-7777-8888-9999-000000000000';
    const xrm = { ...xrmStub(),
      webApiGet: vi.fn().mockResolvedValue([{ formid: formA, name: 'Main' }, { formid: formB, name: 'Information' }]),
      webApiGetEntity: vi.fn().mockResolvedValue({ formxml: '<form/>' }) };
    const onChange = vi.fn();
    await render(
      <PreviewPanel
        config={cfg({ host: { entityName: 'account', formId: formA } })}
        onChange={onChange}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={new MetadataService(xrm)}
        xrm={xrm}
      />
    );
    const formTab = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Form')!;
    await act(async () => { formTab.click(); });
    await act(async () => { await Promise.resolve(); });
    expect(xrm.webApiGetEntity).toHaveBeenCalledWith(expect.stringContaining(`systemforms(${formA})`));

    await chooseOption(host!, 'Form', 'Information');
    expect(onChange).toHaveBeenCalledTimes(1);
    const updater = onChange.mock.calls[0][0] as (prev: ReturnType<typeof cfg>) => ReturnType<typeof cfg>;
    expect(updater(cfg({ host: { entityName: 'account', formId: formA } })).host.formId).toBe(formB);
  });

  it('keeps a preview-local table for the console trigger', async () => {
    const metadataService = {
      ...mockMetadataService,
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
        { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
      ] }),
    } as unknown as MetadataService;
    const xrm = { ...xrmStub(), webApiGet: vi.fn().mockResolvedValue([]) };
    const onChange = vi.fn();
    await render(
      <PreviewPanel
        config={cfg({ trigger: { kind: 'ManualJS' } })}
        onChange={onChange}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={metadataService}
        xrm={xrm}
      />
    );
    const formTab = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Form')!;
    await act(async () => { formTab.click(); });
    await chooseTable(host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Preview entity"]')!, 'account');
    expect(onChange).not.toHaveBeenCalled();
    expect(host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Preview entity"]')!.value).toContain('Account');
  });
});

describe('PreviewPanel — lookup-source Form preview', () => {
  const related = cfg({
    trigger: { kind: 'FormButton' },
    host: { entityName: 'account', formId: '11111111-2222-3333-4444-555555555555' },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
    context: { source: { kind: 'lookup', attribute: 'primarycontactid' } },
  });

  async function openForm(fetchXmlQuery: ReturnType<typeof vi.fn>, config = related) {
    const xrm = { ...xrmStub(), fetchXml: fetchXmlQuery as IXrmContext['fetchXml'],
      webApiGet: vi.fn().mockResolvedValue([{ formid: '11111111-2222-3333-4444-555555555555', name: 'Account' }]),
      webApiGetEntity: vi.fn().mockResolvedValue({ formxml: '<form/>' }) };
    const panel = (value: typeof related) => <PreviewPanel config={value} validation={{ isValid: true, errors: [], warnings: [] }}
      metadataService={mockMetadataService} xrm={xrm} />;
    await render(panel(config));
    const tab = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Form')!;
    await act(async () => { tab.click(); });
    return async (value: typeof related) => { await act(async () => { root!.render(panel(value)); }); };
  }

  async function loadSample() {
    const button = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Load sample account record');
    expect(button).toBeTruthy();
    await act(async () => { button!.click(); });
  }

  it('reads one sample source record on request and reveals its lookup record in the pane', async () => {
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [{
      _primarycontactid_value: 'contact-id',
      '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
    }] });
    await openForm(fetchXmlQuery);
    expect(host!.textContent).toContain('Account (sample)');
    expect(fetchXmlQuery).not.toHaveBeenCalled();
    await loadSample();
    const xml = fetchXmlQuery.mock.calls[0][0] as string;
    expect(xml).toContain('<entity name="account">');
    expect(xml).toContain('<condition attribute="primarycontactid" operator="not-null"/>');
    expect(host!.textContent).toContain('Pat Lee · contact-id');
  });

  it('keeps the pane closed when no source record has the lookup set', async () => {
    await openForm(vi.fn().mockResolvedValue({ value: [] }));
    await loadSample();
    expect(host!.textContent).toContain('No account record has a primarycontactid value, so the pane does not open.');
    expect(host!.textContent).not.toContain(related.pane.title);
  });

  const sampleRow = { value: [{
    _primarycontactid_value: 'contact-id',
    '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
  }] };

  it.each([true, false])('keeps an isSelected:false pane unselected on every sample open (reuseExistingPane=%s)', async reuseExistingPane => {
    const fetchXmlQuery = vi.fn().mockResolvedValue(sampleRow);
    await openForm(fetchXmlQuery, { ...related, pane: { ...related.pane, isSelected: false },
      behavior: { ...related.behavior, reuseExistingPane } });
    await loadSample();
    expect(host!.textContent).not.toContain('Pat Lee · contact-id');
    await loadSample();
    expect(fetchXmlQuery).toHaveBeenCalledTimes(2);
    expect(host!.textContent).not.toContain('Pat Lee · contact-id');
  });

  it.each([[true, true], [false, false]])(
    'after a selected open, an isSelected:false reopen keeps the pane only when reusing it (reuseExistingPane=%s)',
    async (reuseExistingPane, visible) => {
      const base = { ...related, behavior: { ...related.behavior, reuseExistingPane } };
      const rerender = await openForm(vi.fn().mockResolvedValue(sampleRow), base);
      await loadSample();
      expect(host!.textContent).toContain('Pat Lee · contact-id');
      await rerender({ ...base, pane: { ...base.pane, isSelected: false } });
      await loadSample();
      expect(host!.textContent!.includes('Pat Lee · contact-id')).toBe(visible);
    });
});

describe('PreviewPanel — form layout load failures', () => {
  const formId = '11111111-2222-3333-4444-555555555555';

  async function loadForm(webApiGetEntity: IXrmContext['webApiGetEntity']) {
    const xrm = { ...xrmStub(), webApiGet: vi.fn().mockResolvedValue([{ formid: formId, name: 'Account' }]), webApiGetEntity };
    await render(<PreviewPanel config={cfg({ host: { entityName: 'account', formId } })}
      validation={{ isValid: true, errors: [], warnings: [] }} metadataService={new MetadataService(xrm)} xrm={xrm} />);
    const formTab = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Form')!;
    await act(async () => { formTab.click(); });
    await act(async () => { await Promise.resolve(); });
  }

  it.each([
    ['a 404 response', () => Promise.reject(new DataverseError('Not Found', 404, 'Not Found')), 'Form not found in this environment.'],
    ['unreadable FormXML', () => Promise.resolve({ formxml: 'NOT_XML<<<' }), 'Form layout could not be read.'],
    ['a 403 response', () => Promise.reject(new DataverseError('Forbidden', 403, 'Forbidden')), 'Could not load form layout (HTTP 403).'],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch')), 'Could not load form layout. Check your connection.'],
    ['a status 0 response', () => Promise.reject(new DataverseError('Network Error', 0)), 'Could not load form layout. Check your connection.'],
  ])('explains %s with its own message', async (_label, respond, message) => {
    await loadForm(vi.fn(respond) as IXrmContext['webApiGetEntity']);
    const error = Array.from(host!.querySelectorAll('div')).find(el => el.textContent === message);
    expect(error, message).toBeTruthy();
  });
});

describe('PreviewPanel — lookup-source Grid source controls', () => {
  it('shows an editable source table beside the view and lookup controls', async () => {
    const metadataService = {
      ...mockMetadataService,
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
        { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
        { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
      ] }),
      listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
      listLookupAttributes: vi.fn().mockResolvedValue([]),
    } as unknown as MetadataService;
    const related = cfg({
      trigger: { kind: 'GridRowSelect' },
      host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { source: { kind: 'lookup', attribute: '' } },
    });
    await render(<PreviewPanel config={related} validation={{ isValid: true, errors: [], warnings: [] }}
      metadataService={metadataService} xrm={xrmStub()} />);
    const gridTab = Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!;
    await act(async () => { gridTab.click(); });
    const group = host!.querySelector('[role="group"][aria-label="Grid source"]')!;
    expect(group).toBeTruthy();
    expect(group.querySelector('[role="combobox"][aria-label="Source table"]')).toBeTruthy();
    expect(group.querySelector('[role="combobox"][aria-label="Lookup column"]')).toBeTruthy();
    expect(group.querySelector('[role="combobox"][aria-label="View"]')).toBeTruthy();
  });

  it('updates shared config on source changes, clears preview state, and ignores a late prior-source fetch', async () => {
    const sourceViews = {
      account: { id: 'account-view', name: 'Accounts', viewType: 'savedquery' as const,
        fetchXml: '<fetch><entity name="account"><attribute name="name"/></entity></fetch>',
        layoutXml: '<grid><row><cell name="name"/></row></grid>' },
      contact: { id: 'contact-view', name: 'Contacts', viewType: 'savedquery' as const,
        fetchXml: '<fetch><entity name="contact"><attribute name="fullname"/></entity></fetch>',
        layoutXml: '<grid><row><cell name="fullname"/></row></grid>' },
    };
    const listViewsForEntity = vi.fn(async (entityName: string) => ({
      status: 'ok' as const, views: [sourceViews[entityName as keyof typeof sourceViews]],
    }));
    const listLookupAttributes = vi.fn(async (entityName: string) => entityName === 'account'
      ? [{ LogicalName: 'primarycontactid', Targets: ['contact'] }]
      : [
        { LogicalName: 'parentcustomerid', Targets: ['account'] },
        { LogicalName: 'regardingobjectid', Targets: ['account', 'contact'] },
      ]);
    const metadataService = {
      ...mockMetadataService,
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
        { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
        { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
      ] }),
      listViewsForEntity,
      listLookupAttributes,
      listAttributeLabels: vi.fn().mockImplementation(async (entityName: string) => [{
        LogicalName: entityName === 'account' ? 'name' : 'fullname',
        DisplayName: { UserLocalizedLabel: { Label: entityName === 'account' ? 'Name' : 'Full Name' } },
      }]),
    } as unknown as MetadataService;
    let resolveOldFetch!: (value: { value: Record<string, unknown>[] }) => void;
    const fetchXml = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveOldFetch = resolve; }))
      .mockResolvedValue({ value: [] });
    const xrm = { ...xrmStub(), fetchXml };
    const initial = cfg({
      trigger: { kind: 'GridRowSelect' },
      host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: 'old-form', tabName: 'old-tab', data: '' },
      context: { source: { kind: 'lookup', attribute: 'primarycontactid' } },
    });
    function ControlledPanel() {
      const [config, setConfig] = React.useState(initial);
      const targetState = config.target.pageType === 'entityrecord'
        ? `${config.target.entityName}|${config.target.formId}|${config.target.tabName}` : '';
      const attribute = config.context.source.kind === 'lookup' ? config.context.source.attribute : '';
      return <><output aria-label="current config">{config.host.entityName}|{attribute}|{targetState}</output>
        <PreviewPanel config={config} onChange={updater => setConfig(updater)} validation={{ isValid: true, errors: [], warnings: [] }}
          metadataService={metadataService} xrm={xrm} /></>;
    }
    await render(<ControlledPanel />);
    const tab = Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!;
    await act(async () => { tab.click(); });
    const viewInput = () => host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="View"]')!;
    await chooseOption(host!, 'View', 'Accounts');
    const generate = () => Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!;
    expect(generate().disabled).toBe(false);
    await act(async () => { generate().click(); });
    expect(fetchXml).toHaveBeenCalledTimes(1);

    const sourceInput = host!.querySelector<HTMLInputElement>('[aria-label="Source table"]')!;
    await chooseTable(sourceInput, 'contact');
    expect(host!.querySelector('[aria-label="current config"]')?.textContent).toBe('contact||||');
    expect(listViewsForEntity).toHaveBeenCalledWith('contact');
    expect(listLookupAttributes).toHaveBeenCalledWith('contact');
    expect(viewInput().value).toBe('');
    expect(generate().disabled).toBe(true);

    await act(async () => { resolveOldFetch({ value: [{ fullname: 'Stale contact' }] }); });
    expect(host!.textContent).not.toContain('Stale contact');

    await chooseOption(host!, 'Lookup column', 'parentcustomerid');
    expect(host!.querySelector('[aria-label="current config"]')?.textContent).toBe('contact|parentcustomerid|account||');
    await chooseOption(host!, 'Lookup column', 'regardingobjectid');
    expect(host!.querySelector('[aria-label="current config"]')?.textContent).toBe('contact|regardingobjectid|||');
    expect(host!.textContent).toContain('Possible destination tables: account, contact. Determined by the selected row.');
    await chooseOption(host!, 'View', 'Contacts');
    expect(generate().disabled).toBe(false);
    await act(async () => { generate().click(); });
    expect(fetchXml).toHaveBeenCalledTimes(2);
    expect(fetchXml.mock.calls[1][0]).toContain('<entity name="contact">');
    expect(fetchXml.mock.calls[1][0]).toContain('name="regardingobjectid"');
  });

  it('writes the grid source table into the host', async () => {
    const listViewsForEntity = vi.fn(async (entityName: string) => ({ status: 'ok' as const, views: [{
      id: `${entityName}-view`, name: `${entityName} view`, viewType: 'savedquery' as const,
      fetchXml: `<fetch><entity name="${entityName}"><attribute name="name"/></entity></fetch>`,
      layoutXml: '<grid><row><cell name="name"/></row></grid>',
    }] }));
    const metadataService = {
      ...mockMetadataService,
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
        { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
        { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
      ] }),
      listViewsForEntity,
      listAttributeLabels: vi.fn().mockResolvedValue([
        { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Name' } } },
      ]),
    } as unknown as MetadataService;
    const fetchXml = vi.fn().mockResolvedValue({ value: [] });
    const initial = cfg({ trigger: { kind: 'GridRowSelect' }, host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } });
    function ControlledPanel() {
      const [config, setConfig] = React.useState(initial);
      return <><output aria-label="host table">{config.host.entityName}</output>
        <PreviewPanel config={config} onChange={updater => setConfig(updater)}
          validation={{ isValid: true, errors: [], warnings: [] }} metadataService={metadataService}
          xrm={{ ...xrmStub(), fetchXml }} /></>;
    }
    await render(<ControlledPanel />);
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!.click(); });
    const sourceInput = host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Source table"]')!;
    await chooseTable(sourceInput, 'contact');
    expect(host!.querySelector('[aria-label="host table"]')?.textContent).toBe('contact');
    await chooseOption(host!, 'View', 'contact view');
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!.click(); });
    expect(fetchXml.mock.calls[0][0]).toContain('<entity name="contact">');
  });

  it('closes the pane and discards the active row when the RelatedRecord source changes', async () => {
    const accountView = { id: 'account-view', name: 'Accounts', viewType: 'savedquery' as const,
      fetchXml: '<fetch><entity name="account"><attribute name="name"/></entity></fetch>',
      layoutXml: '<grid><row><cell name="name"/></row></grid>' };
    const metadataService = {
      ...mockMetadataService,
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
        { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
        { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
      ] }),
      listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [accountView] }),
      listLookupAttributes: vi.fn().mockResolvedValue([{ LogicalName: 'primarycontactid', Targets: ['contact'] }]),
      listAttributeLabels: vi.fn().mockResolvedValue([
        { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Name' } } },
      ]),
    } as unknown as MetadataService;
    const initial = cfg({ trigger: { kind: 'GridRowSelect' }, host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { source: { kind: 'lookup', attribute: 'primarycontactid' } } });
    function ControlledPanel() {
      const [config, setConfig] = React.useState(initial);
      return <PreviewPanel config={config} onChange={updater => setConfig(updater)}
        validation={{ isValid: true, errors: [], warnings: [] }} metadataService={metadataService}
        xrm={{ ...xrmStub(), fetchXml: vi.fn().mockResolvedValue({ value: [{ name: 'Acme',
          _primarycontactid_value: 'contact-id',
          '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee' }] }) }} />;
    }
    await render(<ControlledPanel />);
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!.click(); });
    await chooseOption(host!, 'View', 'Accounts');
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!.click(); });
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).toContain('Pat Lee · contact-id');
    const source = host!.querySelector<HTMLInputElement>('[aria-label="Source table"]')!;
    await chooseTable(source, 'contact');
    expect(host!.textContent).not.toContain('Pat Lee · contact-id');
    expect(host!.textContent).not.toContain('SelectedRow: row 1');
    expect(host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="View"]')!.value).toBe('');
  });

  it('preserves an imported lookup and destination when lookup metadata fails, and blocks generation', async () => {
    const metadataService = {
      ...mockMetadataService,
      listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
      listLookupAttributes: vi.fn().mockRejectedValue(new Error('Metadata unavailable')),
    } as unknown as MetadataService;
    const config = cfg({ trigger: { kind: 'GridRowSelect' }, host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: 'saved-form', tabName: 'details', data: '' },
      context: { source: { kind: 'lookup', attribute: 'primarycontactid' } } });
    const fetchXml = vi.fn();
    await render(<PreviewPanel config={config} validation={{ isValid: true, errors: [], warnings: [] }}
      metadataService={metadataService} xrm={{ ...xrmStub(), fetchXml }} />);
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!.click(); });
    expect(host!.textContent).toContain('Lookup columns could not be checked, so the saved destination is unchanged.');
    expect(host!.textContent).toContain('Metadata unavailable');
    expect(Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!.disabled).toBe(true);
    expect(config.host.entityName).toBe('account');
    expect(config.context.source).toEqual({ kind: 'lookup', attribute: 'primarycontactid' });
    expect(config.target).toMatchObject({ pageType: 'entityrecord', entityName: 'contact', formId: 'saved-form', tabName: 'details' });
    expect(fetchXml).not.toHaveBeenCalled();
  });

  it('does not restore a selected row after A to B to A with intervening view and lookup changes', async () => {
    const accountViews = ['account-view-a', 'account-view-b'].map((id, index) => ({
      id, name: `Account view ${index + 1}`, viewType: 'savedquery' as const,
      fetchXml: '<fetch><entity name="account"><attribute name="name"/></entity></fetch>',
      layoutXml: '<grid><row><cell name="name"/></row></grid>',
    }));
    const contactView = { id: 'contact-view', name: 'Contact view', viewType: 'savedquery' as const,
      fetchXml: '<fetch><entity name="contact"><attribute name="fullname"/></entity></fetch>',
      layoutXml: '<grid><row><cell name="fullname"/></row></grid>' };
    const metadataService = {
      ...mockMetadataService,
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [
        { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
        { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
      ] }),
      listViewsForEntity: vi.fn(async (entityName: string) => ({ status: 'ok' as const,
        views: entityName === 'account' ? accountViews : [contactView] })),
      listLookupAttributes: vi.fn(async (entityName: string) => entityName === 'account'
        ? [{ LogicalName: 'primarycontactid', Targets: ['contact'] }]
        : [{ LogicalName: 'parentcustomerid', Targets: ['account'] }]),
      listAttributeLabels: vi.fn().mockImplementation(async (entityName: string) => [{
        LogicalName: entityName === 'account' ? 'name' : 'fullname',
        DisplayName: { UserLocalizedLabel: { Label: entityName === 'account' ? 'Name' : 'Full Name' } },
      }]),
    } as unknown as MetadataService;
    const fetchXml = vi.fn().mockResolvedValue({ value: [{ name: 'Account cached row',
      _primarycontactid_value: 'contact-id',
      '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee' }] });
    const initial = cfg({ trigger: { kind: 'GridRowSelect' }, host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { source: { kind: 'lookup', attribute: 'primarycontactid' } } });
    function ControlledPanel() {
      const [config, setConfig] = React.useState(initial);
      return <PreviewPanel config={config} onChange={updater => setConfig(updater)}
        validation={{ isValid: true, errors: [], warnings: [] }} metadataService={metadataService}
        xrm={{ ...xrmStub(), fetchXml }} />;
    }
    await render(<ControlledPanel />);
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!.click(); });
    const selectView = (name: string) => chooseOption(host!, 'View', name);
    for (const name of ['Account view 1', 'Account view 2', 'Account view 1', 'Account view 2', 'Account view 1']) {
      await selectView(name);
    }
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!.click(); });
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).toContain('Account cached row');
    expect(host!.textContent).toContain('Pat Lee · contact-id');

    const selectSource = (entityName: string) =>
      chooseTable(host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Source table"]')!, entityName);
    const selectLookup = (logicalName: string) => chooseOption(host!, 'Lookup column', logicalName);
    await selectSource('contact');
    await selectLookup('parentcustomerid');
    await selectView('Contact view');
    await selectSource('account');
    await selectLookup('primarycontactid');
    await selectView('Account view 1');

    expect(host!.textContent).not.toContain('Account cached row');
    expect(host!.textContent).not.toContain('Pat Lee · contact-id');
    expect(host!.querySelector('tbody tr')).toBeNull();
    expect(fetchXml).toHaveBeenCalledTimes(1);
  });
});
