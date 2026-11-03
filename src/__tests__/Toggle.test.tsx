import * as React from 'react';
import { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Toggle } from '../components/Toggle';
import { ThemeProvider } from '../contexts/ThemeContext';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<ThemeProvider>{element}</ThemeProvider>); });
}

/** Elements the browser's Tab key visits, in document order. */
function tabbable(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]'))
    .filter(element => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled);
}

/** Space as the browser handles it: a native button turns an unprevented keyup into a click. */
async function pressSpace(element: HTMLElement): Promise<void> {
  await act(async () => {
    const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    element.dispatchEvent(down);
    const up = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
    element.dispatchEvent(up);
    if (element instanceof HTMLButtonElement && !down.defaultPrevented && !up.defaultPrevented) element.click();
  });
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('Toggle', () => {
  function Harness(): React.ReactElement {
    const [checked, setChecked] = useState(false);
    return <>
      <button type="button">Before</button>
      <Toggle label="Reuse open pane" desc="Navigate the existing pane" checked={checked} onChange={setChecked} />
    </>;
  }

  it('is the next Tab stop and takes focus as a switch', async () => {
    await render(<Harness />);
    const control = host!.querySelector<HTMLElement>('[role="switch"][aria-label="Reuse open pane"]')!;
    const stops = tabbable(host!);
    expect(stops).toEqual([stops[0], control]);
    await act(async () => { control.focus(); });
    expect(document.activeElement).toBe(control);
    expect(control.style.outline).toMatch(/^2px solid/);
    await act(async () => { control.blur(); });
    expect(control.style.outline).toBe('none');
  });

  it('toggles with Space and reports the state through aria-checked', async () => {
    await render(<Harness />);
    const control = host!.querySelector<HTMLElement>('[role="switch"]')!;
    expect(control.getAttribute('aria-checked')).toBe('false');
    await pressSpace(control);
    expect(control.getAttribute('aria-checked')).toBe('true');
    await pressSpace(control);
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles on click', async () => {
    await render(<Harness />);
    const control = host!.querySelector<HTMLElement>('[role="switch"]')!;
    await act(async () => { control.click(); });
    expect(control.getAttribute('aria-checked')).toBe('true');
  });
});
