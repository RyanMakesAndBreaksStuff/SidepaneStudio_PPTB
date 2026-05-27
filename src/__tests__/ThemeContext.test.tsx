import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

type ToolboxEventPayload = {
  event: string;
  data: unknown;
  timestamp: string;
};

type ToolboxEventHandler = (event: string, payload: ToolboxEventPayload) => void;

function ThemeProbe(): React.ReactElement {
  const { isDark } = useTheme();
  return <div data-testid="theme">{isDark ? 'dark' : 'light'}</div>;
}

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

async function flushTheme() {
  await act(async () => {
    await Promise.resolve();
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

describe('ThemeProvider', () => {
  it('hydrates from the current toolbox theme on startup', async () => {
    vi.stubGlobal('toolboxAPI', {
      utils: {
        getCurrentTheme: vi.fn().mockResolvedValue('light'),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
    });

    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    await flushTheme();

    expect(host?.textContent).toBe('light');
    expect(window.toolboxAPI.utils.getCurrentTheme).toHaveBeenCalledTimes(1);
  });

  it('refreshes when toolbox settings change after the tool is open', async () => {
    let eventHandler: ToolboxEventHandler | undefined;
    const getCurrentTheme = vi.fn()
      .mockResolvedValueOnce('light')
      .mockResolvedValueOnce('dark');

    vi.stubGlobal('toolboxAPI', {
      utils: {
        getCurrentTheme,
      },
      events: {
        on: vi.fn((handler: ToolboxEventHandler) => { eventHandler = handler; }),
        off: vi.fn(),
      },
    });

    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    await flushTheme();
    expect(host?.textContent).toBe('light');

    expect(eventHandler).toBeDefined();
    await act(async () => {
      eventHandler?.('settings:updated', {
        event: 'settings:updated',
        data: { key: 'ui.theme' },
        timestamp: new Date().toISOString(),
      });
      await Promise.resolve();
    });

    expect(host?.textContent).toBe('dark');
    expect(getCurrentTheme).toHaveBeenCalledTimes(2);
  });
});
