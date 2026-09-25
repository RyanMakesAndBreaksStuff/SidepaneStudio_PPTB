import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SidePaneBuilderWorkbench } from '../SidePaneBuilderWorkbench';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

vi.mock('../components/ConfigurePanel', async () => {
  const { TablePicker } = await import('../components/TablePicker');
  return {
    ConfigurePanel: ({ metadataService, config }: {
      metadataService: React.ComponentProps<typeof TablePicker>['metadataService'];
      config: PaneDefinitionConfig;
    }) => <TablePicker
      metadataService={metadataService}
      value={config.target.pageType === 'entityrecord' ? config.target.entityName : ''}
      onChange={() => {}}
    />,
  };
});
vi.mock('../components/PreviewPanel', () => ({ PreviewPanel: () => null }));
vi.mock('../components/OutputPanel', () => ({ OutputPanel: () => null }));
vi.mock('../components/CommandBar', () => ({ CommandBar: () => null }));

type Handler = (event: unknown, payload: ToolBoxAPI.ToolBoxEventPayload) => void;
let handler: Handler;
let root: Root;
let host: HTMLDivElement;
let org: string;
let getActiveConnection: ReturnType<typeof vi.fn>;
let on: ReturnType<typeof vi.fn>;
let off: ReturnType<typeof vi.fn>;

beforeEach(() => {
  org = 'a';
  getActiveConnection = vi.fn().mockResolvedValue({ id: 'a' });
  on = vi.fn((callback: Handler) => { handler = callback; });
  off = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('toolboxAPI', {
    connections: { getActiveConnection },
    events: { on, off },
    settings: {
      get: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  });
  vi.stubGlobal('dataverseAPI', {
    queryData: vi.fn(async () => ({ value: [{
      LogicalName: `new_${org}`,
      SchemaName: `new_${org}`,
      EntitySetName: `new_${org}s`,
      IsCustomEntity: true,
      DisplayName: { UserLocalizedLabel: { Label: `Org ${org}` } },
    }] })),
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  expect(off).toHaveBeenCalledWith(handler);
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount() {
  await act(async () => { root.render(<SidePaneBuilderWorkbench />); });
}

async function emit(event: ToolBoxAPI.ToolBoxEventPayload['event']) {
  await act(async () => {
    handler({ senderId: 'transport' }, { event, data: null, timestamp: '2026-09-23' });
  });
}

function options() {
  return Array.from(host.querySelectorAll('option')).map(option => option.value);
}

it('replaces org A table choices after a connection update', async () => {
  await mount();
  expect(options()).toContain('new_a');
  org = 'b';
  getActiveConnection.mockResolvedValue({ id: 'b' });
  await emit('connection:updated');
  expect(options()).toContain('new_b');
  expect(options()).not.toContain('new_a');
  expect(on).toHaveBeenCalledTimes(1);
});

function storeTargetTable(entityName: string) {
  const settings = (window.toolboxAPI as unknown as { settings: { get: ReturnType<typeof vi.fn> } }).settings;
  settings.get.mockImplementation(async (key: string) => key === 'lastConfig' ? JSON.stringify({
    ...DEFAULT_CONFIG,
    target: { pageType: 'entityrecord', entityName, formId: 'form-a', tabName: 'tab-a', data: '' },
  }) : null);
}

it('clears the old org table selection when the connection switches orgs', async () => {
  storeTargetTable('new_a');
  await mount();
  expect(host.querySelector('select')?.value).toBe('new_a');
  org = 'b';
  getActiveConnection.mockResolvedValue({ id: 'b' });
  await emit('connection:updated');
  expect(options()).toContain('new_b');
  expect(options()).not.toContain('new_a');
  expect(host.textContent).not.toContain('no longer accessible');
});

it('keeps the table selection when the same connection is updated', async () => {
  storeTargetTable('new_a');
  await mount();
  await emit('connection:updated');
  expect(host.querySelector('select')?.value).toBe('new_a');
});

it.each(['connection:created', 'connection:updated'] as const)(
  'does not expose table choices when %s leaves no active connection', async event => {
    await mount();
    getActiveConnection.mockResolvedValue(null);
    await emit(event);
    expect(host.textContent).toContain('No active Dataverse connection');
    expect(options()).toEqual([]);
  },
);

it('reloads the remaining active org after a connection is deleted', async () => {
  await mount();
  org = 'b';
  getActiveConnection.mockResolvedValue({ id: 'b' });
  await emit('connection:deleted');
  expect(options()).toContain('new_b');
  expect(options()).not.toContain('new_a');
});

it('ignores a startup check that finishes after a newer disconnected check', async () => {
  const startup = deferred<{ id: string } | null>();
  getActiveConnection.mockReturnValueOnce(startup.promise).mockResolvedValue(null);
  await mount();
  await emit('connection:deleted');
  await act(async () => { startup.resolve({ id: 'a' }); });
  expect(host.textContent).toContain('No active Dataverse connection');
  expect(options()).toEqual([]);
});

it('ignores an older failed event check after a newer successful check', async () => {
  await mount();
  const older = deferred<{ id: string } | null>();
  void older.promise.catch(() => {});
  getActiveConnection.mockReturnValueOnce(older.promise);
  await emit('connection:updated');
  org = 'b';
  getActiveConnection.mockResolvedValue({ id: 'b' });
  await emit('connection:updated');
  await act(async () => { older.reject(new Error('old check failed')); });
  expect(getActiveConnection).toHaveBeenCalledTimes(3);
  expect(options()).toContain('new_b');
  expect(host.textContent).not.toContain('old check failed');
});
