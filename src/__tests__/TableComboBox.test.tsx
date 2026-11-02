import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableComboBox } from '../components/TableComboBox';
import { ThemeContext } from '../contexts/ThemeContext';
import { TableInfo } from '../services/MetadataService';
import { theme } from '../theme/tokens';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

const tables: TableInfo[] = [
  { logicalName: 'account', displayName: 'Account', objectTypeCode: 1, isCustomEntity: false },
  { logicalName: 'new_widget', displayName: 'Widget', objectTypeCode: 100, isCustomEntity: true },
  { logicalName: 'new_widewidget', displayName: 'Wide Widget', objectTypeCode: 101, isCustomEntity: true },
];

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(element); });
}

async function update(element: React.ReactElement) {
  await act(async () => { root?.render(element); });
}

async function focus(input: HTMLInputElement) {
  await act(async () => { input.focus(); });
}

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.bind(input);
    if (!setter) throw new Error('input value setter is unavailable');
    setter(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function key(input: HTMLInputElement, keyName: string) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }));
  });
}

function combo(index = 0): HTMLInputElement {
  return host!.querySelectorAll<HTMLInputElement>('[role="combobox"]')[index];
}

function rgb(hex: string): string {
  const channels = hex.slice(1).match(/.{2}/g)!.map(channel => parseInt(channel, 16));
  return `rgb(${channels.join(', ')})`;
}

function PickerHarness({ value = '', onChange = vi.fn() }: { value?: string; onChange?: (next: string) => void }) {
  const [customOnly, setCustomOnly] = React.useState(false);
  return <TableComboBox value={value} onChange={onChange} tables={tables} customOnly={customOnly}
    onCustomOnlyChange={setCustomOnly} ariaLabel="Table" />;
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
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('TableComboBox', () => {
  it('lists generic items and names the noun in empty copy', async () => {
    await render(<TableComboBox value="" onChange={() => {}} items={[{ logicalName: 'name', displayName: 'Account Name' }]} noun="columns" ariaLabel="Column" />);
    const input = host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Column"]')!;
    await focus(input);
    expect(host!.textContent).toContain('Account Name');
    await type(input, 'zzz');
    expect(host!.textContent).toContain('No columns match "zzz"');
  });

  it('filters by query and filters custom entities before applying the query', async () => {
    await render(<PickerHarness />);
    const input = combo();
    await focus(input);
    await type(input, 'widget');
    expect(host?.querySelectorAll('[role="option"]')).toHaveLength(2);
    await key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toContain('-option-1');

    const filter = host!.querySelector<HTMLButtonElement>('[aria-label="Show custom tables only"]')!;
    await act(async () => { filter.click(); });
    expect(filter.getAttribute('aria-pressed')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toContain('-option-0');
    expect(host?.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(Array.from(host!.querySelectorAll('[role="option"]')).every(option => option.textContent?.includes('new_'))).toBe(true);

    await type(input, 'account');
    expect(host?.textContent).toContain('No tables match "account"');
    expect(host?.querySelectorAll('[role="option"]')).toHaveLength(0);
  });

  it('shows the custom-only empty state and resets highlight when query changes', async () => {
    const onCustomOnlyChange = vi.fn();
    await render(<TableComboBox value="" onChange={vi.fn()} tables={tables.filter(table => !table.isCustomEntity)}
      customOnly onCustomOnlyChange={onCustomOnlyChange} />);
    const input = combo();
    await focus(input);
    expect(host?.textContent).toContain('No custom tables found');

    await update(<TableComboBox value="" onChange={vi.fn()} tables={tables} onCustomOnlyChange={onCustomOnlyChange} />);
    const nextInput = combo();
    await focus(nextInput);
    await key(nextInput, 'ArrowDown');
    expect(nextInput.getAttribute('aria-activedescendant')).toContain('-option-1');
    await type(nextInput, 'account');
    expect(nextInput.getAttribute('aria-activedescendant')).toContain('-option-0');
  });

  it('supports ArrowDown, Enter, and Escape', async () => {
    const onChange = vi.fn();
    await render(<TableComboBox value="" onChange={onChange} tables={tables} ariaLabel="Table" />);
    const input = combo();
    await focus(input);
    await key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toContain('-option-1');
    await key(input, 'Enter');
    expect(onChange).toHaveBeenCalledWith('new_widget');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    await focus(input);
    await type(input, 'wide');
    await key(input, 'Escape');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('');
  });

  it('clears the selection and query without changing the custom-only toggle', async () => {
    const onChange = vi.fn();
    await render(<PickerHarness value="new_widget" onChange={onChange} />);
    const input = combo();
    await focus(input);
    await type(input, 'wide');
    const clear = host!.querySelector<HTMLButtonElement>('[aria-label="Clear selection"]')!;
    await act(async () => {
      clear.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      clear.click();
    });
    expect(onChange).toHaveBeenCalledWith('');
    expect(input.value).toBe('');
    expect(host!.querySelector('[aria-label="Show custom tables only"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('gives each instance unique listbox and option ids and wires aria-controls', async () => {
    await render(<div>
      <TableComboBox value="" onChange={vi.fn()} tables={tables} ariaLabel="First table" />
      <TableComboBox value="" onChange={vi.fn()} tables={tables} ariaLabel="Second table" />
    </div>);
    const inputs = [combo(0), combo(1)];
    await focus(inputs[0]);
    await focus(inputs[1]);
    const listboxes = Array.from(host!.querySelectorAll('[role="listbox"]'));
    const options = Array.from(host!.querySelectorAll('[role="option"]'));
    expect(listboxes).toHaveLength(2);
    expect(new Set(listboxes.map(listbox => listbox.id)).size).toBe(2);
    expect(inputs.map(input => input.getAttribute('aria-controls'))).toEqual(listboxes.map(listbox => listbox.id));
    expect(new Set(options.map(option => option.id)).size).toBe(6);
    expect(inputs.map(input => input.getAttribute('aria-activedescendant'))[0])
      .not.toBe(inputs.map(input => input.getAttribute('aria-activedescendant'))[1]);
  });

  it('disables the filter during loading, error, and disabled state', async () => {
    const props = { value: '', onChange: vi.fn(), tables, onCustomOnlyChange: vi.fn() };
    await render(<TableComboBox {...props} loading />);
    expect(host!.querySelector<HTMLButtonElement>('[aria-label="Show custom tables only"]')?.disabled).toBe(true);
    await update(<TableComboBox {...props} error="offline" />);
    expect(host!.querySelector<HTMLButtonElement>('[aria-label="Show custom tables only"]')?.disabled).toBe(true);
    await update(<TableComboBox {...props} disabled />);
    expect(host!.querySelector<HTMLButtonElement>('[aria-label="Show custom tables only"]')?.disabled).toBe(true);
  });

  it('marks validation errors without hiding available table options', async () => {
    await render(<TableComboBox value="" onChange={vi.fn()} tables={tables} invalid />);
    const input = combo();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.parentElement?.style.borderColor).toBe(rgb(theme(true).error));
    await focus(input);
    expect(host?.querySelectorAll('[role="option"]')).toHaveLength(tables.length);
  });

  it('closes an open popup and blocks keyboard commits when disabled becomes true', async () => {
    const onChange = vi.fn();
    const props = { value: '', onChange, tables };
    await render(<TableComboBox {...props} />);
    const input = combo();
    await focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(host?.querySelectorAll('[role="option"]')).toHaveLength(3);

    await update(<TableComboBox {...props} disabled />);
    expect(combo().disabled).toBe(true);
    expect(combo().getAttribute('aria-expanded')).toBe('false');
    expect(host?.querySelector('[role="listbox"]')).toBeNull();
    await key(combo(), 'Enter');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the Fluent field geometry and theme token colors in both themes', async () => {
    const dark = theme(true);
    const light = theme(false);
    const picker = (isDark: boolean) => <ThemeContext.Provider value={{ isDark }}>
      <TableComboBox value="" onChange={vi.fn()} tables={tables} />
    </ThemeContext.Provider>;
    await render(picker(true));
    const input = combo();
    const field = input.parentElement!;
    expect(field.style.height).toBe('32px');
    expect(field.style.borderColor).toBe(rgb(dark.stroke1));
    expect(field.querySelector('svg')?.getAttribute('stroke')).toBe(dark.fg3);
    await focus(input);
    expect(field.style.boxShadow).toContain(dark.accent);

    await update(picker(false));
    expect(field.style.borderColor).toBe(rgb(light.stroke1));
    expect(field.querySelector('svg')?.getAttribute('stroke')).toBe(light.fg3);
    await focus(combo());
    expect(field.style.boxShadow).toContain(light.accent);
  });
});
