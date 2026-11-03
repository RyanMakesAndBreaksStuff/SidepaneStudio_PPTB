import * as React from 'react';
import { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { ThemeProvider } from '../contexts/ThemeContext';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo', disabled: true },
  { value: 'c', label: 'Charlie' },
];

async function render(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<ThemeProvider>{element}</ThemeProvider>); });
}

function radio(label: string): HTMLButtonElement {
  const button = Array.from(host?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])
    .find(item => item.textContent === label);
  if (!button) throw new Error(`Radio ${label} was not found`);
  return button;
}

/** Elements the browser's Tab key visits, in document order. */
function tabbable(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]'))
    .filter(element => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled);
}

async function press(element: HTMLElement, key: string): Promise<void> {
  await act(async () => { element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('ChoiceGroup', () => {
  it('does not report a change when the selected pill is clicked again', async () => {
    const onChange = vi.fn();
    await render(<ChoiceGroup label="Letter" options={OPTIONS} value="a" onChange={onChange} />);
    await act(async () => { radio('Alpha').click(); });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => { radio('Charlie').click(); });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('names the radiogroup with the human label', async () => {
    await render(<ChoiceGroup label="Content type" options={OPTIONS} value="a" onChange={vi.fn()} />);
    expect(host?.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Content type');
  });

  it('puts only the selected pill in the tab order', async () => {
    await render(<ChoiceGroup label="Letter" options={OPTIONS} value="c" onChange={vi.fn()} />);
    expect(tabbable(host!)).toEqual([radio('Charlie')]);
  });

  it('puts the first enabled pill in the tab order when nothing is selected', async () => {
    await render(<ChoiceGroup label="Letter" options={OPTIONS} value="" onChange={vi.fn()} />);
    expect(tabbable(host!)).toEqual([radio('Alpha')]);
  });

  it('moves focus and selection with the arrow keys, skipping disabled pills and wrapping', async () => {
    let current = 'a';
    function Harness(): React.ReactElement {
      const [value, setValue] = useState('a');
      current = value;
      return <ChoiceGroup label="Letter" options={OPTIONS} value={value} onChange={setValue} />;
    }
    await render(<Harness />);
    radio('Alpha').focus();
    await press(radio('Alpha'), 'ArrowRight');
    expect(current).toBe('c');
    expect(document.activeElement).toBe(radio('Charlie'));
    expect(tabbable(host!)).toEqual([radio('Charlie')]);
    await press(radio('Charlie'), 'ArrowRight');
    expect(current).toBe('a');
    expect(document.activeElement).toBe(radio('Alpha'));
    await press(radio('Alpha'), 'ArrowLeft');
    expect(current).toBe('c');
    expect(document.activeElement).toBe(radio('Charlie'));
  });
});
