import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { DEFAULT_METADATA_FILTER_CONFIG, type MetadataFilterConfig } from '../types/MetadataFilterConfig';
import type { MetadataService } from '../services/MetadataService';

const workbenchShellState = vi.hoisted(() => ({
  props: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../components/WorkbenchShell', () => ({
  WorkbenchShell: (props: {
    config: PaneDefinitionConfig;
    onChange: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
    [key: string]: unknown;
  }) => {
    workbenchShellState.props = props;
    return (
      <div>
        <span data-testid="title">{props.config.pane.title}</span>
        <button
          type="button"
          onClick={() => props.onChange(prev => ({ ...prev, pane: { ...prev.pane, title: 'Edited Title' } }))}
        >
          Edit title
        </button>
      </div>
    );
  },
}));

import { SidePaneBuilderWorkbench } from '../SidePaneBuilderWorkbench';
import { ThemeContext } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { deferred, rgb } from './testHelpers';

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

beforeEach(() => {
  vi.useFakeTimers();
  class ResizeObserverStub {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  host?.remove();
  root = undefined;
  host = undefined;
  workbenchShellState.props = undefined;
});

describe('SidePaneBuilderWorkbench', () => {
  it('snaps an illegal selection through coerceConfig on change', async () => {
    const settingsSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: vi.fn().mockResolvedValue(null), set: settingsSet },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      const onChange = workbenchShellState.props?.onChange as (update: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
      onChange(prev => ({ ...prev, trigger: { ...prev.trigger, kind: 'ManualJS' } }));
    });
    await act(async () => { vi.advanceTimersByTime(500); await Promise.resolve(); });
    const saved = settingsSet.mock.calls.find(([key]) => key === 'lastConfig');
    expect(JSON.parse(saved![1]).context.source.kind).toBe('none');
  });
  it('does not save default config before hydration and persists user edits after hydration', async () => {
    const restoredConfig = {
      ...DEFAULT_CONFIG,
      pane: { ...DEFAULT_CONFIG.pane, title: 'Restored Title' },
    };
    const getLastConfig = deferred<string | null>();
    const settingsSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('toolboxAPI', {
      connections: {
        getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
      settings: {
        get: vi.fn(() => getLastConfig.promise),
        set: settingsSet,
      },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(settingsSet).not.toHaveBeenCalled();

    await act(async () => {
      getLastConfig.resolve(JSON.stringify(restoredConfig));
      await Promise.resolve();
    });
    expect(host?.textContent).toContain('Restored Title');

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(settingsSet).not.toHaveBeenCalled();

    await act(async () => {
      host?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(settingsSet).toHaveBeenCalledWith(
      'lastConfig',
      expect.stringContaining('"title":"Edited Title"')
    );
  });

  it('hydrates metadata filter settings and exposes save/reset handlers', async () => {
    const getAll = vi.fn()
      .mockResolvedValueOnce({
        lastConfig: '{"pane":{}}',
        'metadataFilters.denyPrefixes': ['new_'],
        'metadataFilters.denyExact': ['account'],
        'metadataFilters.allowedStandardTables': ['contact'],
      })
      .mockResolvedValue({ lastConfig: '{"pane":{}}' });
    const settingsSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('toolboxAPI', {
      connections: {
        getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
      settings: {
        get: vi.fn().mockResolvedValue(null),
        set: settingsSet,
        getAll,
      },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(workbenchShellState.props?.metadataFilterConfig).toEqual({
      denyPrefixes: ['new_'],
      denyExact: ['account'],
      allowedStandardTables: ['contact'],
    });
    expect(workbenchShellState.props?.metadataFilterPersistenceAvailable).toBe(true);

    await act(async () => {
      const save = workbenchShellState.props?.onSaveMetadataFilterConfig as (
        config: typeof DEFAULT_METADATA_FILTER_CONFIG
      ) => Promise<void>;
      await save({
        denyPrefixes: ['abc_'],
        denyExact: ['webresource'],
        allowedStandardTables: ['account'],
      });
    });

    expect(settingsSet).toHaveBeenCalledTimes(1);
    expect(settingsSet).toHaveBeenCalledWith('metadataFilters', {
      denyPrefixes: ['abc_'],
      denyExact: ['webresource'],
      allowedStandardTables: ['account'],
    });
    expect(settingsSet).not.toHaveBeenCalledWith('lastConfig', expect.anything());
    expect(workbenchShellState.props?.metadataFilterConfig).toEqual({
      denyPrefixes: ['abc_'],
      denyExact: ['webresource'],
      allowedStandardTables: ['account'],
    });

    await act(async () => {
      const reset = workbenchShellState.props?.onResetMetadataFilterConfig as () => Promise<void>;
      await reset();
    });

    expect(workbenchShellState.props?.metadataFilterConfig).toEqual(DEFAULT_METADATA_FILTER_CONFIG);
    expect(settingsSet).toHaveBeenCalledTimes(2);
    expect(settingsSet).toHaveBeenLastCalledWith('metadataFilters', DEFAULT_METADATA_FILTER_CONFIG);
  });

  it('applies each metadata filter save and reset result to the service, the shell and the error state', async () => {
    const settingsSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: vi.fn().mockResolvedValue(null), set: settingsSet, getAll: vi.fn().mockResolvedValue({}) },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    const setFilterConfig = vi.spyOn(workbenchShellState.props?.metadataService as MetadataService, 'setFilterConfig');
    const save = workbenchShellState.props?.onSaveMetadataFilterConfig as (config: MetadataFilterConfig) => Promise<void>;
    const reset = workbenchShellState.props?.onResetMetadataFilterConfig as () => Promise<void>;
    const custom: MetadataFilterConfig = { denyPrefixes: ['abc_'], denyExact: [], allowedStandardTables: ['account'] };

    settingsSet.mockRejectedValueOnce(new Error('settings backend offline'));
    await act(async () => { await save(custom); });
    expect(workbenchShellState.props?.metadataFilterError).toBe('settings backend offline');
    expect(setFilterConfig).not.toHaveBeenCalled();

    await act(async () => { await save(custom); });
    expect(setFilterConfig).toHaveBeenLastCalledWith(custom);
    expect(workbenchShellState.props?.metadataFilterConfig).toEqual(custom);
    expect(workbenchShellState.props?.metadataFilterPersistenceAvailable).toBe(true);
    expect(workbenchShellState.props?.metadataFilterError).toBeNull();

    settingsSet.mockRejectedValueOnce(new Error('settings backend offline'));
    await act(async () => { await reset(); });
    expect(workbenchShellState.props?.metadataFilterError).toBe('settings backend offline');
    expect(workbenchShellState.props?.metadataFilterConfig).toEqual(custom);

    await act(async () => { await reset(); });
    expect(setFilterConfig).toHaveBeenLastCalledWith(DEFAULT_METADATA_FILTER_CONFIG);
    expect(workbenchShellState.props?.metadataFilterConfig).toEqual(DEFAULT_METADATA_FILTER_CONFIG);
    expect(workbenchShellState.props?.metadataFilterError).toBeNull();
  });

  it('surfaces a failed settings write instead of dropping it', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const settingsSet = vi.fn().mockRejectedValue(new Error('settings backend offline'));

    vi.stubGlobal('toolboxAPI', {
      connections: {
        getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
      settings: {
        get: vi.fn().mockResolvedValue(null),
        set: settingsSet,
      },
      utils: {
        showNotification,
      },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      host?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(settingsSet).toHaveBeenCalledWith(
      'lastConfig',
      expect.stringContaining('"title":"Edited Title"')
    );
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  });

  it('does not report reset success when clearing the saved configuration fails', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const settingsSet = vi.fn().mockRejectedValue(new Error('settings backend offline'));

    vi.stubGlobal('toolboxAPI', {
      connections: {
        getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
      settings: {
        get: vi.fn().mockResolvedValue(null),
        set: settingsSet,
      },
      utils: {
        showNotification,
      },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      const onReset = workbenchShellState.props?.onReset as () => Promise<void>;
      await onReset();
    });

    expect(settingsSet).toHaveBeenCalledWith('lastConfig', null);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
    expect(showNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
  });

  it('reports reset success only after the settings write resolves', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const settingsSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('toolboxAPI', {
      connections: {
        getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
      settings: {
        get: vi.fn().mockResolvedValue(null),
        set: settingsSet,
      },
      utils: {
        showNotification,
      },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      const onReset = workbenchShellState.props?.onReset as () => Promise<void>;
      await onReset();
    });

    expect(settingsSet).toHaveBeenCalledWith('lastConfig', null);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', body: expect.stringMatching(/\S/) })
    );
  });

  it('requires an explicit choice before saving after restore fails', async () => {
    const settingsSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: vi.fn().mockRejectedValue(new Error('offline')), set: settingsSet },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(host?.querySelector('[role="alert"]')?.textContent).toContain('Could not restore');
    expect(host?.textContent).toContain('Retry restore');
    expect(host?.textContent).toContain('Continue with defaults');
    await act(async () => { vi.advanceTimersByTime(600); await Promise.resolve(); });
    expect(settingsSet).not.toHaveBeenCalled();
    await act(async () => {
      Array.from(host?.querySelectorAll('button') ?? [])
        .find(button => button.textContent === 'Continue with defaults')?.click();
    });
    await act(async () => {
      Array.from(host?.querySelectorAll('button') ?? [])
        .find(button => button.textContent === 'Edit title')?.click();
    });
    await act(async () => { vi.advanceTimersByTime(600); await Promise.resolve(); });
    expect(settingsSet).toHaveBeenCalledWith('lastConfig', expect.stringContaining('"title":"Edited Title"'));
  });

  it.each([['light', false], ['dark', true]] as const)(
    'draws the restore-failure screen from the %s theme tokens', async (_, isDark) => {
      vi.stubGlobal('toolboxAPI', {
        connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
        events: { on: vi.fn(), off: vi.fn() },
        settings: { get: vi.fn().mockRejectedValue(new Error('offline')), set: vi.fn().mockResolvedValue(undefined) },
      });
      await render(<ThemeContext.Provider value={{ isDark }}><SidePaneBuilderWorkbench /></ThemeContext.Provider>);
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      const screen = host?.querySelector<HTMLElement>('[role="alert"]');
      expect(screen?.style.backgroundColor).toBe(rgb(theme(isDark).pageBg));
      expect(screen?.style.color).toBe(rgb(theme(isDark).fg1));
    }
  );

  it.each([
    ['malformed JSON', '{not json'],
    ['an unknown trigger kind', JSON.stringify({ ...DEFAULT_CONFIG, trigger: { ...DEFAULT_CONFIG.trigger, kind: 'Nope' } })],
  ])('routes an unreadable stored config (%s) to the restore recovery screen without overwriting it', async (_label, payload) => {
    const settingsSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: vi.fn().mockResolvedValue(payload), set: settingsSet },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(host?.querySelector('[role="alert"]')?.textContent).toContain('could not be read');
    expect(host?.textContent).toContain('Retry restore');
    expect(host?.textContent).toContain('Continue with defaults');
    expect(host?.querySelector('[data-testid="title"]')).toBeNull();
    await act(async () => { vi.advanceTimersByTime(600); await Promise.resolve(); });
    expect(settingsSet).not.toHaveBeenCalled();
    await act(async () => {
      Array.from(host?.querySelectorAll('button') ?? [])
        .find(button => button.textContent === 'Continue with defaults')?.click();
    });
    expect(host?.querySelector('[data-testid="title"]')?.textContent).toBe(DEFAULT_CONFIG.pane.title);
  });

  it('restores a config whose optional fields are wrong-typed, with those fields defaulted', async () => {
    const stored = JSON.stringify({
      ...DEFAULT_CONFIG,
      pane: { ...DEFAULT_CONFIG.pane, title: 'Restored Title' },
      trigger: { ...DEFAULT_CONFIG.trigger, kind: 'ManualJS' },
      context: { ...DEFAULT_CONFIG.context, source: { kind: 'none' } },
      target: { pageType: 'entitylist', entityName: 'account', viewId: 5 },
    });
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: vi.fn().mockResolvedValue(stored), set: vi.fn().mockResolvedValue(undefined) },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(host?.querySelector('[role="alert"]')).toBeNull();
    expect(host?.textContent).toContain('Restored Title');
    expect((workbenchShellState.props?.config as PaneDefinitionConfig).target)
      .toEqual({ pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' });
  });

  it('retries a rejected restore without replacing saved config', async () => {
    const restored = { ...DEFAULT_CONFIG, pane: { ...DEFAULT_CONFIG.pane, title: 'Restored Title' } };
    const settingsGet = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(JSON.stringify(restored));
    const settingsSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: settingsGet, set: settingsSet },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => {
      Array.from(host?.querySelectorAll('button') ?? [])
        .find(button => button.textContent === 'Retry restore')?.click();
      await Promise.resolve();
    });
    expect(host?.textContent).toContain('Restored Title');
    expect(settingsGet).toHaveBeenCalledTimes(2);
    expect(settingsSet).not.toHaveBeenCalled();
  });

  it('does not apply a pending restore after reset', async () => {
    const pendingGet = deferred<string | null>();
    const settingsSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: vi.fn(() => pendingGet.promise), set: settingsSet },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      const reset = workbenchShellState.props?.onReset as () => Promise<void>;
      await reset();
    });
    const restored = { ...DEFAULT_CONFIG, pane: { ...DEFAULT_CONFIG.pane, title: 'Stale Title' } };
    await act(async () => { pendingGet.resolve(JSON.stringify(restored)); await Promise.resolve(); });
    expect(host?.querySelector('[data-testid="title"]')?.textContent).toBe(DEFAULT_CONFIG.pane.title);
    expect(settingsSet).toHaveBeenCalledTimes(1);
    expect(settingsSet).toHaveBeenNthCalledWith(1, 'lastConfig', null);
  });

  it('surfaces a metadata filter save failure as an error instead of clearing it', async () => {
    const getAll = vi.fn().mockResolvedValue({ lastConfig: '{"pane":{}}' });
    const settingsSet = vi.fn().mockRejectedValue(new Error('metadata settings backend offline'));

    vi.stubGlobal('toolboxAPI', {
      connections: {
        getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
      settings: {
        get: vi.fn().mockResolvedValue(null),
        set: settingsSet,
        getAll,
      },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      const save = workbenchShellState.props?.onSaveMetadataFilterConfig as (
        config: typeof DEFAULT_METADATA_FILTER_CONFIG
      ) => Promise<void>;
      await save({
        denyPrefixes: ['abc_'],
        denyExact: ['webresource'],
        allowedStandardTables: ['account'],
      });
    });

    expect(settingsSet).toHaveBeenCalledTimes(1);
    expect(settingsSet).toHaveBeenCalledWith('metadataFilters', expect.anything());
    expect(workbenchShellState.props?.metadataFilterError).toBe('metadata settings backend offline');
    // The failed write must not have been applied to displayed state.
    expect(workbenchShellState.props?.metadataFilterConfig).toEqual(DEFAULT_METADATA_FILTER_CONFIG);
  });

  it('surfaces a metadata filter reset failure as an error instead of clearing it', async () => {
    const getAll = vi.fn().mockResolvedValue({ lastConfig: '{"pane":{}}' });
    const settingsSet = vi.fn().mockRejectedValue(new Error('metadata settings backend offline'));

    vi.stubGlobal('toolboxAPI', {
      connections: {
        getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
      settings: {
        get: vi.fn().mockResolvedValue(null),
        set: settingsSet,
        getAll,
      },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      const reset = workbenchShellState.props?.onResetMetadataFilterConfig as () => Promise<void>;
      await reset();
    });

    expect(settingsSet).toHaveBeenCalledTimes(1);
    expect(settingsSet).toHaveBeenCalledWith('metadataFilters', expect.anything());
    expect(workbenchShellState.props?.metadataFilterError).toBe('metadata settings backend offline');
    expect(workbenchShellState.props?.metadataFilterConfig).toEqual(DEFAULT_METADATA_FILTER_CONFIG);
  });

  it('shows the connection error when a deletion leaves no active connection', async () => {
    let handler: ((event: unknown, payload: ToolBoxAPI.ToolBoxEventPayload) => void) | undefined;

    vi.stubGlobal('toolboxAPI', {
      connections: {
        getActiveConnection: vi.fn()
          .mockResolvedValueOnce({ id: 'conn-1' })
          .mockResolvedValue(null),
      },
      events: {
        on: vi.fn((cb) => { handler = cb; }),
        off: vi.fn(),
      },
      settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });

    expect(handler).toBeDefined();

    await act(async () => {
      handler!({ senderId: 'ipc' }, {
        event: 'connection:deleted',
        data: null,
        timestamp: new Date().toISOString(),
      });
      await Promise.resolve();
    });

    // The deletion event rechecks the host and finds no active connection.
    expect(host?.textContent).toContain('No active Dataverse connection');
  });

  it('unsubscribes from host events on unmount with the disposer events.on returns', async () => {
    const dispose = vi.fn();
    const off = vi.fn();
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(() => dispose), off },
      settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { root?.unmount(); });
    root = undefined;

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
  });

  it('does not throw when the host emits an unrelated event', async () => {
    let handler: ((event: unknown, payload: ToolBoxAPI.ToolBoxEventPayload) => void) | undefined;

    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn((cb) => { handler = cb; }), off: vi.fn() },
      settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) },
    });

    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });

    expect(() => handler!(undefined, {
      event: 'terminal:output',
      data: null,
      timestamp: new Date().toISOString(),
    })).not.toThrow();
  });

  it.each([
    ['rejects', () => vi.fn().mockRejectedValueOnce(new Error('host busy')).mockResolvedValue({ id: 'conn-1' }), 'host busy'],
    ['finds no connection', () => vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'conn-1' }), 'No active Dataverse connection'],
  ] as const)('offers Retry when getActiveConnection %s, and recovers on success', async (_label, makeGet, message) => {
    const getActiveConnection = makeGet();
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(host?.textContent).toContain(message);

    const retry = Array.from(host?.querySelectorAll('button') ?? []).find(b => b.textContent === 'Retry');
    expect(retry, 'Retry button').toBeDefined();
    await act(async () => { retry?.click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(getActiveConnection).toHaveBeenCalledTimes(2);
    expect(host?.querySelector('[data-testid="title"]')).not.toBeNull();
  });

  it('offers no Retry when toolboxAPI itself is missing', async () => {
    vi.stubGlobal('toolboxAPI', undefined);
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); });
    expect(host?.textContent).toContain('toolboxAPI unavailable');
    expect(Array.from(host?.querySelectorAll('button') ?? []).some(b => b.textContent === 'Retry')).toBe(false);
  });
});

describe('SidePaneBuilderWorkbench — pending save flush', () => {
  const settingsSet = vi.fn();

  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  async function renderHydrated() {
    settingsSet.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', {
      connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
      events: { on: vi.fn(), off: vi.fn() },
      settings: { get: vi.fn().mockResolvedValue(null), set: settingsSet },
    });
    await render(<SidePaneBuilderWorkbench />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  }

  async function editTitle() {
    await act(async () => {
      Array.from(host?.querySelectorAll('button') ?? []).find(b => b.textContent === 'Edit title')?.click();
    });
  }

  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('writes the pending edit as soon as the window is hidden, and only once', async () => {
    await renderHydrated();
    await editTitle();
    expect(settingsSet).not.toHaveBeenCalled();

    await act(async () => { setVisibility('hidden'); });
    expect(settingsSet).toHaveBeenCalledTimes(1);
    expect(settingsSet).toHaveBeenCalledWith('lastConfig', expect.stringContaining('"title":"Edited Title"'));

    await act(async () => { vi.advanceTimersByTime(600); await Promise.resolve(); });
    expect(settingsSet).toHaveBeenCalledTimes(1);
  });

  it('writes the pending edit when the page is hidden for unload (r2 WR-008)', async () => {
    await renderHydrated();
    await editTitle();
    expect(settingsSet).not.toHaveBeenCalled();

    await act(async () => { window.dispatchEvent(new Event('pagehide')); });
    expect(settingsSet).toHaveBeenCalledTimes(1);
    expect(settingsSet).toHaveBeenCalledWith('lastConfig', expect.stringContaining('"title":"Edited Title"'));
  });

  it('writes nothing on hide when no edit is pending', async () => {
    await renderHydrated();
    await act(async () => { setVisibility('hidden'); });
    await act(async () => { setVisibility('visible'); });
    expect(settingsSet).not.toHaveBeenCalled();
  });

  it('writes the pending edit when the workbench unmounts', async () => {
    await renderHydrated();
    await editTitle();
    expect(settingsSet).not.toHaveBeenCalled();

    await act(async () => { root?.unmount(); });
    root = undefined;

    expect(settingsSet).toHaveBeenCalledTimes(1);
    expect(settingsSet).toHaveBeenCalledWith('lastConfig', expect.stringContaining('"title":"Edited Title"'));
  });

  it('does not write the pre-reset config when the window is hidden after Reset', async () => {
    await renderHydrated();
    await editTitle();
    await act(async () => {
      const onReset = workbenchShellState.props?.onReset as () => Promise<void>;
      await onReset();
    });
    await act(async () => { setVisibility('hidden'); });

    expect(settingsSet).toHaveBeenCalledTimes(1);
    expect(settingsSet).toHaveBeenCalledWith('lastConfig', null);
  });

  it('keeps the 500 ms debounce for ordinary edits', async () => {
    await renderHydrated();
    await editTitle();
    await editTitle();
    await act(async () => { vi.advanceTimersByTime(499); });
    expect(settingsSet).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
    expect(settingsSet).toHaveBeenCalledTimes(1);
  });
});
