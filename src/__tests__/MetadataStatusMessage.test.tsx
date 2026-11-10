import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetadataStatusMessage } from '../components/MetadataStatusMessage';
import { ThemeContext } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { rgb } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(isDark: boolean, element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(<ThemeContext.Provider value={{ isDark }}>{element}</ThemeContext.Provider>);
  });
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe.each([['light', false], ['dark', true]] as const)('MetadataStatusMessage in the %s theme', (_, isDark) => {
  const T = theme(isDark);

  it('draws the failure text in the error colour with a themed Retry button that retries', async () => {
    const retry = vi.fn();
    await render(isDark, <MetadataStatusMessage request={{ status: 'error', error: 'offline', retry }} />);
    const alert = host!.querySelector<HTMLElement>('[role="alert"]')!;
    expect(alert.style.color).toBe(rgb(T.error));
    const button = alert.querySelector<HTMLButtonElement>('button')!;
    expect(button.textContent).toBe('Retry');
    expect(button.style.color).toBe(rgb(T.error));
    expect(button.style.borderColor).toBe(rgb(T.error));
    expect(button.style.backgroundColor).toBe(rgb(T.pageBg));
    expect(button.style.borderRadius).toBe(T.rS);
    await act(async () => { button.click(); });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('mutes the Retry button while the picker is disabled', async () => {
    const retry = vi.fn();
    await render(isDark, <MetadataStatusMessage request={{ status: 'error', error: 'offline', retry }} disabled />);
    const button = host!.querySelector<HTMLButtonElement>('[role="alert"] button')!;
    expect(button.disabled).toBe(true);
    expect(button.style.color).toBe(rgb(T.fg3));
    expect(button.style.borderColor).toBe(rgb(T.fg3));
  });
});
