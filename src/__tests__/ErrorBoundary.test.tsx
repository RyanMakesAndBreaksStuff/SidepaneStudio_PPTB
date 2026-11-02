import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('render exploded');
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;
let reload: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(element);
  });
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(host?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes(label));
  if (!found) throw new Error(`button not found: ${label}`);
  return found;
}

async function click(label: string) {
  await act(async () => {
    button(label).click();
  });
}

beforeEach(() => {
  reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload },
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  host?.remove();
  root = undefined;
  host = undefined;
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('shows the fallback when a child throws', async () => {
    await render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(host?.textContent).toContain('Side Pane Studio hit an unexpected error');
    expect(host?.textContent).toContain('render exploded');
  });

  it('does not reload and shows the reset error when clearing settings fails', async () => {
    const set = vi.fn().mockRejectedValue(new Error('disk locked'));
    vi.stubGlobal('toolboxAPI', { settings: { set } });
    await render(<ErrorBoundary><Boom /></ErrorBoundary>);

    await click('Reset configuration');

    expect(set).toHaveBeenCalledWith('lastConfig', null);
    expect(reload).not.toHaveBeenCalled();
    expect(host?.textContent).toContain('Could not clear the saved configuration: disk locked');
    expect(host?.textContent).toContain('render exploded');
    expect(button('Copy error details')).toBeTruthy();
  });

  it('reloads once when clearing settings succeeds', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { settings: { set } });
    await render(<ErrorBoundary><Boom /></ErrorBoundary>);

    await click('Reset configuration');
    await click('Reset configuration');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads from "Reload anyway" after a failed reset, at most once', async () => {
    vi.stubGlobal('toolboxAPI', { settings: { set: vi.fn().mockRejectedValue(new Error('nope')) } });
    await render(<ErrorBoundary><Boom /></ErrorBoundary>);
    await click('Reset configuration');

    await click('Reload anyway');
    await click('Reload anyway');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('copies error details via the clipboard', async () => {
    vi.stubGlobal('toolboxAPI', { settings: { set: vi.fn().mockRejectedValue(new Error('nope')) } });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await render(<ErrorBoundary><Boom /></ErrorBoundary>);
    await click('Reset configuration');

    await click('Copy error details');

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('render exploded');
    expect(writeText.mock.calls[0][0]).toContain('Reset failure: nope');
    expect(host?.textContent).toContain('Copied');
  });

  it('uses a transient textarea when the clipboard API is unavailable', async () => {
    vi.stubGlobal('toolboxAPI', { settings: { set: vi.fn().mockRejectedValue(new Error('nope')) } });
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: exec });
    await render(<ErrorBoundary><Boom /></ErrorBoundary>);
    await click('Reset configuration');

    await click('Copy error details');

    expect(exec).toHaveBeenCalledWith('copy');
    expect(host?.textContent).toContain('Copied');
    expect(document.querySelector('body > textarea')).toBeNull();
  });
});
