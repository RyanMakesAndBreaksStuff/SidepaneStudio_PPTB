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
    .filter(button => button.textContent === 'Hide standard tables');
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
function choices(select = host.querySelector('select')!) {
  return Array.from(select.options).map(option => option.value).filter(Boolean);
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
  expect(choices()).toEqual(['account', 'new_event', 'new_unknown']);
  await click(filter());
  expect(filter().getAttribute('aria-pressed')).toBe('true');
  expect(host.querySelector('select')!.value).toBe('');
  expect(choices()).toEqual(['new_event']);
  expect(accessible).toHaveBeenLastCalledWith(new Set(tables.map(table => table.logicalName)));
  await choose(host.querySelector('select')!, 'new_event');
  await click(filter());
  expect(host.querySelector('select')!.value).toBe('new_event');
  expect(choices()).toEqual(['account', 'new_event', 'new_unknown']);
  expect(listAccessibleTables).toHaveBeenCalledTimes(1);
});

it('keeps a selected custom table and handles an empty custom subset', async () => {
  const onChange = vi.fn();
  const service = metadata();
  await render(<TablePicker value="new_event" onChange={onChange} metadataService={service} />);
  await click(filter());
  expect(host.querySelector('select')!.value).toBe('new_event');
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
  await click(filter());
  expect(host.querySelector('select[aria-label="Form"]')).toBeNull();
  expect(selected).toHaveBeenLastCalledWith(null);
  expect(getForms).toHaveBeenCalledTimes(1);
  await act(async () => { host.querySelector<HTMLInputElement>('[role="combobox"]')!.focus(); });
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

it('retains the grid filter through the entity-keyed remount', async () => {
  const service = metadata();
  function GridHost() {
    const [entity, setEntity] = React.useState('account');
    return <PreviewSessionProvider><GridPreview key={entity}
      config={DEFAULT_CONFIG} validation={validation} metadataService={service}
      entityName={entity} allowEntityChange onEntityNameChange={setEntity} />
    </PreviewSessionProvider>;
  }
  await render(<GridHost />);
  await click(filter());
  expect(filter().getAttribute('aria-pressed')).toBe('true');
  expect(choices()).toEqual(['new_event']);
  await choose(host.querySelector('select')!, 'new_event');
  expect(filter().getAttribute('aria-pressed')).toBe('true');
  expect(choices()).toEqual(['new_event']);
});
