import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { WidthPicker } from '../components/WidthPicker';
import { ThemeProvider } from '../contexts/ThemeContext';

function setup(initial = 400) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const calls: number[] = [];
  const onChange = vi.fn((v: number) => { calls.push(v); void rerender(v); });
  const rerender = async (value: number) => {
    await act(async () => root.render(<ThemeProvider><WidthPicker value={value} onChange={onChange} /></ThemeProvider>));
  };
  const input = () => host.querySelector<HTMLInputElement>('input[aria-label="Pane width in pixels"]')!;
  const slider = () => host.querySelector<HTMLInputElement>('input[type="range"]')!;
  const type = async (el: HTMLInputElement, text: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.bind(el);
    await act(async () => { setter(text); el.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  const blur = async (el: HTMLInputElement) => { await act(async () => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }); };
  const cleanup = async () => { await act(async () => root.unmount()); host.remove(); };
  return { host, calls, onChange, rerender: () => rerender(initial), input, slider, type, blur, cleanup };
}

it('typing 600 digit by digit commits 600 and never clamps to 300', async () => {
  const t = setup(400);
  try {
    await t.rerender();
    for (const text of ['6', '60', '600']) await t.type(t.input(), text);
    expect(t.calls).toEqual([600]);
    expect(t.calls).not.toContain(300);
    expect(t.input().value).toBe('600');
  } finally { await t.cleanup(); }
});

it('clamps to min on blur', async () => {
  const t = setup(400);
  try {
    await t.rerender();
    await t.type(t.input(), '5');
    await t.type(t.input(), '50');
    expect(t.calls).toEqual([]);
    await t.blur(t.input());
    expect(t.calls).toEqual([300]);
    expect(t.input().value).toBe('300');
  } finally { await t.cleanup(); }
});

it('clamps to max on blur', async () => {
  const t = setup(400);
  try {
    await t.rerender();
    await t.type(t.input(), '2000');
    expect(t.calls).toEqual([]);
    await t.blur(t.input());
    expect(t.calls).toEqual([1200]);
    expect(t.input().value).toBe('1200');
  } finally { await t.cleanup(); }
});

it('clamps and commits on Enter', async () => {
  const t = setup(400);
  try {
    await t.rerender();
    await t.type(t.input(), '2000');
    await act(async () => { t.input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(t.calls).toEqual([1200]);
  } finally { await t.cleanup(); }
});

it('commits slider changes immediately and syncs the draft', async () => {
  const t = setup(400);
  try {
    await t.rerender();
    await t.type(t.slider(), '700');
    expect(t.calls).toEqual([700]);
    expect(t.input().value).toBe('700');
  } finally { await t.cleanup(); }
});

it('preset click updates the displayed draft', async () => {
  const t = setup(400);
  try {
    await t.rerender();
    await t.type(t.input(), '5');
    const preset = [...t.host.querySelectorAll('button')].find(b => b.textContent === '800')!;
    await act(async () => preset.click());
    expect(t.calls).toEqual([800]);
    expect(t.input().value).toBe('800');
  } finally { await t.cleanup(); }
});
