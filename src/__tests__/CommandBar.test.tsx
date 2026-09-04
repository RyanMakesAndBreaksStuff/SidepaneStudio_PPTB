import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandBar } from '../components/CommandBar';
import { ThemeProvider } from '../contexts/ThemeContext';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(element);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function buttons(): HTMLButtonElement[] {
  return Array.from(host?.querySelectorAll('button') ?? []);
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

describe('CommandBar', () => {
  it('renders no in-tool theme toggle', async () => {
    vi.stubGlobal('toolboxAPI', {
      utils: { getCurrentTheme: vi.fn().mockResolvedValue('dark'), showNotification: vi.fn() },
      events: { on: vi.fn(), off: vi.fn() },
    });

    await render(
      <ThemeProvider>
        <CommandBar onReset={vi.fn()} />
      </ThemeProvider>
    );

    const labels = buttons().map(b => b.textContent ?? '');
    expect(labels.some(l => l.includes('Light') || l.includes('Dark'))).toBe(false);
  });

  it('confirms and resets on Reset click', async () => {
    vi.stubGlobal('toolboxAPI', {
      utils: { getCurrentTheme: vi.fn().mockResolvedValue('dark'), showNotification: vi.fn() },
      events: { on: vi.fn(), off: vi.fn() },
    });
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const onReset = vi.fn();

    await render(
      <ThemeProvider>
        <CommandBar onReset={onReset} />
      </ThemeProvider>
    );

    const resetButton = buttons().find(b => (b.textContent ?? '').includes('Reset'));
    expect(resetButton).toBeTruthy();

    await act(async () => {
      resetButton!.click();
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('does not itself report a success notification on reset — it cannot know the persistence outcome', async () => {
    const showNotification = vi.fn();
    vi.stubGlobal('toolboxAPI', {
      utils: { getCurrentTheme: vi.fn().mockResolvedValue('dark'), showNotification },
      events: { on: vi.fn(), off: vi.fn() },
    });
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const onReset = vi.fn();

    await render(
      <ThemeProvider>
        <CommandBar onReset={onReset} />
      </ThemeProvider>
    );

    const resetButton = buttons().find(b => (b.textContent ?? '').includes('Reset'));

    await act(async () => {
      resetButton!.click();
    });

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('does not reset when the confirm dialog is declined', async () => {
    vi.stubGlobal('toolboxAPI', {
      utils: { getCurrentTheme: vi.fn().mockResolvedValue('dark'), showNotification: vi.fn() },
      events: { on: vi.fn(), off: vi.fn() },
    });
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onReset = vi.fn();

    await render(
      <ThemeProvider>
        <CommandBar onReset={onReset} />
      </ThemeProvider>
    );

    const resetButton = buttons().find(b => (b.textContent ?? '').includes('Reset'));
    await act(async () => {
      resetButton!.click();
    });

    expect(onReset).not.toHaveBeenCalled();
  });
});
