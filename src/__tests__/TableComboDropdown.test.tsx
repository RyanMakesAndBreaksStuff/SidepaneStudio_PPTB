import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableComboBox } from '../components/TableComboBox';
import { ThemeProvider } from '../contexts/ThemeContext';
import type { ComboItem } from '../components/previewHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

const items: ComboItem[] = [
  { logicalName: 'account', displayName: 'Account', isCustomEntity: false },
  { logicalName: 'new_widget', displayName: 'Widget', isCustomEntity: true },
];

/** Elements the browser's Tab key visits, in document order. */
function tabbable(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]'))
    .filter(element => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled);
}

function Picker({ onChange }: { onChange: (next: string) => void }): React.ReactElement {
  const [customOnly, setCustomOnly] = React.useState(false);
  return <>
    <TableComboBox ariaLabel="Table" value="" items={items} onChange={onChange}
      customOnly={customOnly} onCustomOnlyChange={setCustomOnly} />
    <button type="button">After</button>
  </>;
}

async function render(onChange: (next: string) => void): Promise<HTMLInputElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<ThemeProvider><Picker onChange={onChange} /></ThemeProvider>); });
  const input = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
  await act(async () => { input.focus(); });
  return input;
}

function option(text: string): HTMLElement {
  const found = Array.from(host?.querySelectorAll<HTMLElement>('[role="option"]') ?? []).find(item => item.textContent?.includes(text));
  if (!found) throw new Error(`Option ${text} was not found`);
  return found;
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

describe('TableComboDropdown keyboard and pointer model', () => {
  it('keeps options out of the Tab order while the list is open', async () => {
    const input = await render(vi.fn());
    expect(host!.querySelectorAll('[role="option"]')).toHaveLength(2);
    const stops = tabbable(host!);
    expect(stops[0]).toBe(input);
    expect(stops.some(stop => stop.getAttribute('role') === 'option')).toBe(false);
  });

  it('commits the highlighted option on Enter', async () => {
    const onChange = vi.fn();
    const input = await render(onChange);
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith('new_widget');
  });

  it('commits an option on click', async () => {
    const onChange = vi.fn();
    await render(onChange);
    await act(async () => { option('Widget').click(); });
    expect(onChange).toHaveBeenCalledWith('new_widget');
  });

  it('returns focus to the input after the custom-only filter is toggled', async () => {
    const input = await render(vi.fn());
    const filter = host!.querySelector<HTMLButtonElement>('button[aria-label="Show custom tables only"]')!;
    await act(async () => { filter.focus(); });
    await act(async () => { filter.click(); });
    expect(filter.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(host!.querySelectorAll('[role="option"]')).toHaveLength(1);
  });
});
