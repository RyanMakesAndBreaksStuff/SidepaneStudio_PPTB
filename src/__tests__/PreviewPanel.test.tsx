import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewPanel } from '../components/PreviewPanel';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { MetadataService } from '../services/MetadataService';
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import { cfg, xrmStub } from './testHelpers';

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

  it('completes the form layout load under StrictMode', async () => {
    const xrm = { ...xrmStub(),
      webApiGet: vi.fn().mockResolvedValue([{ formid: '11111111-2222-3333-4444-555555555555', name: 'Account' }]),
      webApiGetEntity: vi.fn().mockResolvedValue({ formxml: '<form/>' }) };
    await render(
      <React.StrictMode>
        <PreviewPanel
          config={cfg({ target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } })}
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
});

describe('PreviewPanel — RelatedRecord Form preview', () => {
  const related = cfg({
    trigger: { kind: 'FormButton' },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
    context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' },
  });

  async function openForm(fetchXmlQuery: ReturnType<typeof vi.fn>) {
    const xrm = { ...xrmStub(), fetchXml: fetchXmlQuery as IXrmContext['fetchXml'],
      webApiGet: vi.fn().mockResolvedValue([{ formid: '11111111-2222-3333-4444-555555555555', name: 'Account' }]),
      webApiGetEntity: vi.fn().mockResolvedValue({ formxml: '<form/>' }) };
    await render(<PreviewPanel config={related} validation={{ isValid: true, errors: [], warnings: [] }}
      metadataService={mockMetadataService} xrm={xrm} />);
    const tab = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Form')!;
    await act(async () => { tab.click(); });
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
});

describe('PreviewPanel — RelatedRecord Grid source controls', () => {
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
      trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: '' },
    });
    await render(<PreviewPanel config={related} validation={{ isValid: true, errors: [], warnings: [] }}
      metadataService={metadataService} xrm={xrmStub()} />);
    const gridTab = Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!;
    await act(async () => { gridTab.click(); });
    expect(host!.querySelector('[role="group"][aria-label="Related record source"]')).toBeTruthy();
    expect(host!.querySelector('select[aria-label="Lookup column"]')).toBeTruthy();
    expect(host!.querySelector('select[aria-label="View"]')).toBeTruthy();
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
      trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: 'old-form', tabName: 'old-tab', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' },
    });
    function ControlledPanel() {
      const [config, setConfig] = React.useState(initial);
      const targetState = config.target.pageType === 'entityrecord'
        ? `${config.target.entityName}|${config.target.formId}|${config.target.tabName}` : '';
      return <><output aria-label="current config">{config.context.entityName}|{config.context.lookupAttribute}|{targetState}</output>
        <PreviewPanel config={config} onChange={updater => setConfig(updater)} validation={{ isValid: true, errors: [], warnings: [] }}
          metadataService={metadataService} xrm={xrm} /></>;
    }
    await render(<ControlledPanel />);
    const tab = Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!;
    await act(async () => { tab.click(); });
    const viewSelect = () => host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => {
      viewSelect().value = 'savedquery:account-view';
      viewSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    const generate = () => Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!;
    expect(generate().disabled).toBe(false);
    await act(async () => { generate().click(); });
    expect(fetchXml).toHaveBeenCalledTimes(1);

    const sourceSelect = host!.querySelector<HTMLSelectElement>('[aria-label="Related record source"] select')!;
    await act(async () => {
      sourceSelect.value = 'contact';
      sourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host!.querySelector('[aria-label="current config"]')?.textContent).toBe('contact||||');
    expect(listViewsForEntity).toHaveBeenCalledWith('contact');
    expect(listLookupAttributes).toHaveBeenCalledWith('contact');
    expect(viewSelect().value).toBe('');
    expect(generate().disabled).toBe(true);

    await act(async () => { resolveOldFetch({ value: [{ fullname: 'Stale contact' }] }); });
    expect(host!.textContent).not.toContain('Stale contact');

    const lookupSelect = () => host!.querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')!;
    await act(async () => {
      lookupSelect().value = 'parentcustomerid';
      lookupSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host!.querySelector('[aria-label="current config"]')?.textContent).toBe('contact|parentcustomerid|account||');
    await act(async () => {
      lookupSelect().value = 'regardingobjectid';
      lookupSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host!.querySelector('[aria-label="current config"]')?.textContent).toBe('contact|regardingobjectid|||');
    expect(host!.textContent).toContain('Possible destination tables: account, contact. Determined by the selected row.');
    await act(async () => {
      viewSelect().value = 'savedquery:contact-view';
      viewSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(generate().disabled).toBe(false);
    await act(async () => { generate().click(); });
    expect(fetchXml).toHaveBeenCalledTimes(2);
    expect(fetchXml.mock.calls[1][0]).toContain('<entity name="contact">');
    expect(fetchXml.mock.calls[1][0]).toContain('name="regardingobjectid"');
  });

  it('keeps non-related source selection local to the preview', async () => {
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
    const config = cfg({ trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } });
    await render(<PreviewPanel config={config} validation={{ isValid: true, errors: [], warnings: [] }}
      metadataService={metadataService} xrm={{ ...xrmStub(), fetchXml }} />);
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!.click(); });
    const sourceSelect = host!.querySelector<HTMLSelectElement>('[aria-label="Preview entity"] select')!;
    await act(async () => {
      sourceSelect.value = 'contact';
      sourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const viewSelect = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => {
      viewSelect.value = 'savedquery:contact-view';
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!.click(); });
    expect(fetchXml.mock.calls[0][0]).toContain('<entity name="contact">');
    expect(config.target).toMatchObject({ pageType: 'entityrecord', entityName: 'account' });
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
    const initial = cfg({ trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' } });
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
    const view = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
    await act(async () => { view.value = 'savedquery:account-view'; view.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!.click(); });
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).toContain('Pat Lee · contact-id');
    const source = host!.querySelector<HTMLSelectElement>('[aria-label="Related record source"] select')!;
    await act(async () => { source.value = 'contact'; source.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host!.textContent).not.toContain('Pat Lee · contact-id');
    expect(host!.textContent).not.toContain('SelectedRow: row 1');
    expect(host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!.value).toBe('');
  });

  it('preserves an imported lookup and destination when lookup metadata fails, and blocks generation', async () => {
    const metadataService = {
      ...mockMetadataService,
      listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
      listLookupAttributes: vi.fn().mockRejectedValue(new Error('Metadata unavailable')),
    } as unknown as MetadataService;
    const config = cfg({ trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: 'saved-form', tabName: 'details', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' } });
    const fetchXml = vi.fn();
    await render(<PreviewPanel config={config} validation={{ isValid: true, errors: [], warnings: [] }}
      metadataService={metadataService} xrm={{ ...xrmStub(), fetchXml }} />);
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!.click(); });
    expect(host!.textContent).toContain('Lookup columns could not be checked, so the saved destination is unchanged.');
    expect(host!.textContent).toContain('Metadata unavailable');
    expect(Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!.disabled).toBe(true);
    expect(config.context).toMatchObject({ entityName: 'account', lookupAttribute: 'primarycontactid' });
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
    const initial = cfg({ trigger: { kind: 'MainGridOnSelect' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
      context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' } });
    function ControlledPanel() {
      const [config, setConfig] = React.useState(initial);
      return <PreviewPanel config={config} onChange={updater => setConfig(updater)}
        validation={{ isValid: true, errors: [], warnings: [] }} metadataService={metadataService}
        xrm={{ ...xrmStub(), fetchXml }} />;
    }
    await render(<ControlledPanel />);
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Grid')!.click(); });
    const selectView = async (id: string) => act(async () => {
      const picker = host!.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
      picker.value = `savedquery:${id}`;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    for (const id of ['account-view-a', 'account-view-b', 'account-view-a', 'account-view-b', 'account-view-a']) {
      await selectView(id);
    }
    await act(async () => { Array.from(host!.querySelectorAll('button')).find(button => button.textContent === 'Generate grid preview')!.click(); });
    await act(async () => { host!.querySelector<HTMLInputElement>('input[aria-label="Select row 1"]')!.click(); });
    expect(host!.textContent).toContain('Account cached row');
    expect(host!.textContent).toContain('Pat Lee · contact-id');

    const selectSource = async (entityName: string) => act(async () => {
      const picker = host!.querySelector<HTMLSelectElement>('[aria-label="Related record source"] select')!;
      picker.value = entityName;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const selectLookup = async (logicalName: string) => act(async () => {
      const picker = host!.querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')!;
      picker.value = logicalName;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await selectSource('contact');
    await selectLookup('parentcustomerid');
    await selectView('contact-view');
    await selectSource('account');
    await selectLookup('primarycontactid');
    await selectView('account-view-a');

    expect(host!.textContent).not.toContain('Account cached row');
    expect(host!.textContent).not.toContain('Pat Lee · contact-id');
    expect(host!.querySelector('tbody tr')).toBeNull();
    expect(fetchXml).toHaveBeenCalledTimes(1);
  });
});
