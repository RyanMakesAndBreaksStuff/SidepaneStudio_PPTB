import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { TablePicker } from '../components/TablePicker';
import { ConfigurePanel } from '../components/ConfigurePanel';
import { FormSelector } from '../components/FormSelector';
import { GridPreview } from '../components/GridPreview';
import { PreviewSessionProvider } from '../contexts/PreviewSessionContext';
import { MetadataService } from '../services/MetadataService';
import { FormXmlService } from '../services/FormXmlService';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { xrmStub } from './testHelpers';

const tables = [
  { logicalName: 'account', displayName: 'Account', objectTypeCode: 1, isCustomEntity: false },
  { logicalName: 'new_event', displayName: 'Event', objectTypeCode: 10001, isCustomEntity: true },
  { logicalName: 'new_unknown', displayName: 'Unknown', objectTypeCode: 10002 },
];
const validation = { isValid: true, errors: [], warnings: [] };
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
let root: Root | undefined;
let host: HTMLDivElement;

function metadata(rows = tables) {
  const service = new MetadataService(xrmStub());
  vi.spyOn(service, 'listAccessibleTables').mockResolvedValue({ status: 'ok', tables: rows });
  vi.spyOn(service, 'listViewsForEntity').mockResolvedValue({ status: 'ok', views: [] });
  return service;
}
async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(element); });
}
function filter(index = 0) {
  const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .filter(button => button.getAttribute('aria-label') === 'Show custom tables only' || button.textContent === 'Only Custom Tables');
  expect(buttons[index], 'custom-only button').toBeTruthy();
  return buttons[index];
}
async function click(button: HTMLButtonElement) {
  await act(async () => { button.click(); });
}
async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function choices() {
  return Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'))
    .map(option => option.querySelectorAll('span')[1]?.textContent ?? '').filter(Boolean);
}
async function openTablePicker(index = 0) {
  const input = host.querySelectorAll<HTMLInputElement>('[role="combobox"]')[index];
  await act(async () => { input.focus(); input.click(); });
}
async function chooseTable(logicalName: string, index = 0) {
  await openTablePicker(index);
  const option = Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'))
    .find(item => item.textContent?.includes(logicalName));
  expect(option, logicalName).toBeTruthy();
  await act(async () => { option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  vi.restoreAllMocks();
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

it('normalizes custom metadata without widening accessible-table rules', async () => {
  const webApiGet = vi.fn().mockResolvedValue([
    { LogicalName: 'account', SchemaName: 'Account', EntitySetName: 'accounts',
      IsCustomEntity: false, IsCustomizable: { Value: true } },
    { LogicalName: 'new_event', SchemaName: 'new_Event', EntitySetName: 'new_events',
      IsCustomEntity: true },
    { LogicalName: 'new_unknown', SchemaName: 'new_Unknown', EntitySetName: 'new_unknowns',
      IsCustomizable: { Value: true } },
    { LogicalName: 'new_private', SchemaName: 'new_Private', EntitySetName: 'new_privates',
      IsCustomEntity: true, IsPrivate: true },
  ]);
  const service = new MetadataService({ webApiGet });
  const result = await service.listAccessibleTables();
  expect(result.status).toBe('ok');
  if (result.status !== 'ok') throw new Error(result.reason);
  expect(result.tables).toEqual(expect.arrayContaining([
    expect.objectContaining({ logicalName: 'account', isCustomEntity: false }),
    expect.objectContaining({ logicalName: 'new_event', isCustomEntity: true }),
    expect.objectContaining({ logicalName: 'new_unknown', isCustomEntity: false }),
  ]));
  expect(result.tables).toHaveLength(3);
  await service.listAccessibleTables();
  expect(webApiGet).toHaveBeenCalledTimes(1);
});

it('clears excluded values, restores choices, and reports full accessibility', async () => {
  const service = metadata();
  const listAccessibleTables = vi.spyOn(service, 'listAccessibleTables');
  const accessible = vi.fn();
  function Picker() {
    const [value, setValue] = React.useState('account');
    return <TablePicker value={value} onChange={setValue}
      metadataService={service} onAccessibleTablesChange={accessible} />;
  }
  await render(<Picker />);
  await openTablePicker();
  expect(choices()).toEqual(['account', 'new_event', 'new_unknown']);
  await click(filter());
  expect(filter().getAttribute('aria-pressed')).toBe('true');
  expect(host.querySelector<HTMLInputElement>('[role="combobox"]')!.value).toBe('');
  expect(choices()).toEqual(['new_event']);
  expect(accessible).toHaveBeenLastCalledWith(new Set(tables.map(table => table.logicalName)));
  await chooseTable('new_event');
  await click(filter());
  await openTablePicker();
  expect(Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'))
    .some(option => option.textContent?.includes('new_event') && option.getAttribute('aria-selected') === 'true')).toBe(true);
  expect(choices()).toEqual(['account', 'new_event', 'new_unknown']);
  expect(listAccessibleTables).toHaveBeenCalledTimes(1);
});

it('keeps a selected custom table and handles an empty custom subset', async () => {
  const onChange = vi.fn();
  const service = metadata();
  await render(<TablePicker value="new_event" onChange={onChange} metadataService={service} />);
  await click(filter());
  expect(Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'))
    .some(option => option.textContent?.includes('new_event') && option.getAttribute('aria-selected') === 'true')).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => {
    root!.render(<TablePicker key="empty" value="" onChange={onChange}
      metadataService={metadata([tables[0]])} />);
  });
  await click(filter());
  expect(host.textContent).toContain('No custom tables found');
  expect(filter().disabled).toBe(false);
  await click(filter());
  expect(choices()).toEqual(['account']);
});

it('disables filtering while metadata is pending and when read-only', async () => {
  const service = metadata();
  vi.spyOn(service, 'listAccessibleTables').mockReturnValue(new Promise(() => undefined));
  await render(<TablePicker value="" onChange={vi.fn()} metadataService={service} />);
  expect(filter().disabled).toBe(true);
  await act(async () => {
    root!.render(<TablePicker key="readonly" value="account" onChange={vi.fn()}
      metadataService={metadata()} disabled />);
  });
  expect(filter().disabled).toBe(true);
});

it('keeps Configure filters independent and clears target dependencies atomically', async () => {
  const service = metadata();
  let latest: PaneDefinitionConfig = {
    ...DEFAULT_CONFIG,
    target: { pageType: 'entityrecord', entityName: 'account', formId: 'old-form',
      tabName: 'old-tab', data: '{"old":true}' },
    context: { ...DEFAULT_CONFIG.context, mode: 'Static', entityName: 'account',
      staticRecordId: 'old-record' },
  };
  function Panel() {
    const [config, setConfig] = React.useState(latest);
    latest = config;
    return <ConfigurePanel config={config} onChange={setConfig}
      validation={validation} metadataService={service} />;
  }
  await render(<Panel />);
  for (const title of ['What opens in the pane', 'Record context']) {
    const button = Array.from(host.querySelectorAll('button'))
      .find(item => item.textContent?.includes(title))!;
    if (button.getAttribute('aria-expanded') === 'false') await click(button);
  }
  await click(filter(0));
  expect(latest.target).toEqual({ pageType: 'entityrecord', entityName: '',
    formId: '', tabName: '', data: '' });
  expect(latest.context.entityName).toBe('account');
  expect(filter(1).getAttribute('aria-pressed')).toBe('false');
  await click(filter(1));
  expect(latest.context.entityName).toBe('');
  expect(latest.context.staticRecordId).toBe('');
});

it('drops old forms, loads only the chosen custom table, and allows explicit resync', async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true, value: vi.fn(),
  });
  const service = metadata();
  const forms = new FormXmlService(xrmStub());
  const getForms = vi.spyOn(forms, 'getFormsForEntityResult')
    .mockImplementation(async entity => ({
      ok: true as const, forms: [{ id: entity + '-form', name: entity + ' form' }],
    }));
  const selected = vi.fn();
  function Selector() {
    const [entity, setEntity] = React.useState('account');
    return <FormSelector entityName={entity} onEntityNameChange={setEntity}
      configuredEntity="account" onUseConfigured={() => setEntity('account')}
      metadataService={service} formXmlService={forms} onFormSelected={selected} />;
  }
  await render(<Selector />);
  expect(host.querySelector('select[aria-label="Form"]')?.textContent).toContain('account form');
  await openTablePicker();
  await click(filter());
  expect(host.querySelector<HTMLInputElement>('[role="combobox"]')?.getAttribute('aria-expanded')).toBe('true');
  expect(choices()).toEqual(['new_event']);
  expect(host.querySelector('select[aria-label="Form"]')).toBeNull();
  expect(selected).toHaveBeenLastCalledWith(null);
  expect(getForms).toHaveBeenCalledTimes(1);
  await openTablePicker();
  const options = Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'));
  expect(options).toHaveLength(1);
  // TableComboDropdown commits on mousedown.
  await act(async () => {
    options[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
  expect(getForms).toHaveBeenLastCalledWith('new_event');
  expect(host.querySelector('select[aria-label="Form"]')?.textContent).toContain('new_event form');
  expect(host.querySelector('select[aria-label="Form"]')?.textContent).not.toContain('account form');
  const useConfigured = Array.from(host.querySelectorAll('button'))
    .find(button => button.textContent?.trim() === 'Use account')!;
  await click(useConfigured);
  expect(filter().getAttribute('aria-pressed')).toBe('false');
  expect(getForms).toHaveBeenLastCalledWith('account');
});

function relatedConfig(source: string): PaneDefinitionConfig {
  return {
    ...DEFAULT_CONFIG,
    target: { pageType: 'entityrecord', entityName: 'account', formId: 'saved-form', tabName: 'saved-tab', data: '' },
    context: { ...DEFAULT_CONFIG.context, mode: 'RelatedRecord', entityName: source, lookupAttribute: 'parentid' },
  };
}
const relatedView = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Active records',
  viewType: 'savedquery' as const,
  fetchXml: '<fetch><entity name="new_event"><attribute name="name"/></entity></fetch>',
  layoutXml: '<grid><row><cell name="name"/></row></grid>',
};
function relatedService() {
  const service = metadata();
  vi.spyOn(service, 'listLookupAttributes').mockResolvedValue([
    { LogicalName: 'parentid', Targets: ['account'] },
  ]);
  vi.spyOn(service, 'listViewsForEntity').mockResolvedValue({ status: 'ok', views: [relatedView] });
  return service;
}
function RelatedGrid({ initial, service }: { initial: PaneDefinitionConfig; service: MetadataService }) {
  const [config, setConfig] = React.useState(initial);
  const target = config.target;
  const targetState = target.pageType === 'entityrecord'
    ? `${target.entityName}|${target.formId}|${target.tabName}`
    : target.pageType === 'entitylist'
      ? `${target.entityName}|${target.viewId}|${target.viewType}`
      : JSON.stringify(target);
  return <>
    <output aria-label="related config">{config.context.entityName}|{config.context.lookupAttribute}|{targetState}</output>
    <PreviewSessionProvider><GridPreview config={config} validation={validation} metadataService={service}
      xrm={xrmStub()} entityName={config.context.entityName} allowEntityChange={false}
      onEntityNameChange={() => undefined} onConfigChange={updater => setConfig(previous => updater(previous))} /></PreviewSessionProvider>
  </>;
}

it('keeps a custom related source, lookup, and view when enabling the custom-only filter', async () => {
  const service = relatedService();
  await render(<RelatedGrid initial={relatedConfig('new_event')} service={service} />);
  const lookup = host.querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')!;
  const view = host.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
  await choose(view, `savedquery:${relatedView.id}`);

  await click(filter());

  expect(filter().getAttribute('aria-pressed')).toBe('true');
  expect(Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'))
    .some(option => option.textContent?.includes('new_event') && option.getAttribute('aria-selected') === 'true')).toBe(true);
  expect(lookup.value).toBe('parentid');
  expect(view.value).toBe(`savedquery:${relatedView.id}`);
  expect(host.querySelector('[aria-label="related config"]')?.textContent).toBe('new_event|parentid|account|saved-form|saved-tab');
});

it('clears a standard related source and resets its dependent lookup and view when enabling the custom-only filter', async () => {
  const service = relatedService();
  await render(<RelatedGrid initial={relatedConfig('account')} service={service} />);
  const view = host.querySelector<HTMLSelectElement>('select[aria-label="View"]')!;
  await choose(view, `savedquery:${relatedView.id}`);

  await click(filter());

  expect(host.querySelector<HTMLInputElement>('[aria-label="Source table"]')?.value).toBe('');
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="Lookup column"]')?.value).toBe('');
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="View"]')?.value).toBe('');
  expect(host.querySelector('[aria-label="related config"]')?.textContent).toBe('||||');
});

it('retains the grid filter through the entity-keyed remount', async () => {
  const service = metadata();
  function GridHost() {
    const [entity, setEntity] = React.useState('account');
    return <PreviewSessionProvider><GridPreview key={entity}
      config={DEFAULT_CONFIG} validation={validation} metadataService={service} xrm={xrmStub()}
      entityName={entity} allowEntityChange onEntityNameChange={setEntity} />
    </PreviewSessionProvider>;
  }
  await render(<GridHost />);
  await click(filter());
  await openTablePicker();
  expect(filter().getAttribute('aria-pressed')).toBe('true');
  expect(choices()).toEqual(['new_event']);
  await chooseTable('new_event');
  expect(filter().getAttribute('aria-pressed')).toBe('true');
  await openTablePicker();
  expect(choices()).toEqual(['new_event']);
});
