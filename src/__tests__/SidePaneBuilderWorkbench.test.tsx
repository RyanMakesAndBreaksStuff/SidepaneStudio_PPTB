import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';

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
import { deferred } from './testHelpers';

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
    const setAll = vi.fn().mockResolvedValue(undefined);

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
        set: vi.fn().mockResolvedValue(undefined),
        getAll,
        setAll,
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

    expect(setAll).toHaveBeenCalledWith({
      lastConfig: '{"pane":{}}',
      'metadataFilters.denyPrefixes': ['abc_'],
      'metadataFilters.denyExact': ['webresource'],
      'metadataFilters.allowedStandardTables': ['account'],
    });
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
  });
});
