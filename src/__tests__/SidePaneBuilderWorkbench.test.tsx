import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';

vi.mock('../components/WorkbenchShell', () => ({
  WorkbenchShell: ({
    config,
    onChange,
  }: {
    config: PaneDefinitionConfig;
    onChange: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
  }) => (
    <div>
      <span data-testid="title">{config.pane.title}</span>
      <button
        type="button"
        onClick={() => onChange(prev => ({ ...prev, pane: { ...prev.pane, title: 'Edited Title' } }))}
      >
        Edit title
      </button>
    </div>
  ),
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
});
