import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusScreen } from '../components/StatusScreen';
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

describe.each([['light', false], ['dark', true]] as const)('StatusScreen in the %s theme', (_, isDark) => {
  const T = theme(isDark);

  it('draws background, title and message from theme tokens and has no buttons without an action', async () => {
    await render(isDark, <StatusScreen role="alert" icon="⚠" title="Connection unavailable" message="Check the connection." />);
    const screen = host!.querySelector<HTMLElement>('[role="alert"]')!;
    expect(screen.style.backgroundColor).toBe(rgb(T.pageBg));
    expect(screen.style.color).toBe(rgb(T.fg1));
    const message = Array.from(screen.querySelectorAll<HTMLElement>('div')).find(el => el.textContent === 'Check the connection.')!;
    expect(message.style.color).toBe(rgb(T.fg2));
    expect(screen.textContent).toContain('Connection unavailable');
    expect(screen.querySelector('button')).toBeNull();
  });

  it('renders a primary and a secondary button from tokens and calls their handlers', async () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    await render(isDark, <StatusScreen message="Could not restore."
      action={{ label: 'Retry restore', onClick: onPrimary }}
      secondaryAction={{ label: 'Continue with defaults', onClick: onSecondary }} />);
    const [primary, secondary] = Array.from(host!.querySelectorAll<HTMLButtonElement>('button'));
    expect(primary.textContent).toBe('Retry restore');
    expect(primary.style.backgroundColor).toBe(rgb(T.accent));
    expect(primary.style.color).toBe(rgb(T.accentFg));
    expect(secondary.textContent).toBe('Continue with defaults');
    expect(secondary.style.borderColor).toBe(rgb(T.strokeAcc));
    expect(secondary.style.color).toBe(rgb(T.fg1));
    await act(async () => { primary.click(); secondary.click(); });
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});
