import * as React from 'react';
import { useState, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TabStrip, tabPanelProps } from '../components/TabStrip';

type Letter = 'a' | 'b' | 'c';
const TABS: { id: Letter; label: string }[] = [
  { id: 'a', label: 'Alpha' }, { id: 'b', label: 'Bravo' }, { id: 'c', label: 'Charlie' },
];

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function Harness(): React.ReactElement {
  const [value, setValue] = useState<Letter>('a');
  return <>
    <TabStrip label="Letters" idPrefix="t" tabs={TABS} value={value} onChange={setValue} tabStyle={() => ({})} />
    <div {...tabPanelProps('t', value)}>{value}</div>
  </>;
}

async function mount(): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<Harness />); });
}

const tab = (label: string) => Array.from(host!.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(t => t.textContent === label)!;
const selected = () => host!.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
async function press(element: HTMLElement, key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', { ...init, key, bubbles: true, cancelable: true });
  await act(async () => { element.dispatchEvent(event); });
  return event;
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('TabStrip (r2 WR-011)', () => {
  it('names the tablist and ties the selected tab to its panel', async () => {
    await mount();
    expect(host!.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Letters');
    const panel = host!.querySelector('[role="tabpanel"]')!;
    expect(tab('Alpha').getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab('Alpha').id);
    expect(tab('Bravo').getAttribute('aria-controls')).toBeNull();
  });

  it('keeps only the selected tab in the tab order', async () => {
    await mount();
    expect(TABS.map(t => tab(t.label).tabIndex)).toEqual([0, -1, -1]);
  });

  it('moves selection and focus with Right, Left, Home and End, wrapping at the ends', async () => {
    await mount();
    tab('Alpha').focus();
    await press(tab('Alpha'), 'ArrowRight');
    expect(selected()).toBe('Bravo');
    expect(document.activeElement).toBe(tab('Bravo'));
    await press(tab('Bravo'), 'End');
    expect(selected()).toBe('Charlie');
    await press(tab('Charlie'), 'ArrowRight');
    expect(selected()).toBe('Alpha');
    await press(tab('Alpha'), 'ArrowLeft');
    expect(selected()).toBe('Charlie');
    await press(tab('Charlie'), 'Home');
    expect(selected()).toBe('Alpha');
    expect(document.activeElement).toBe(tab('Alpha'));
  });

  it('leaves modified keys to the browser', async () => {
    await mount();
    await act(async () => { tab('Bravo').click(); });
    const cases: [KeyboardEventInit, string][] = [
      [{ altKey: true }, 'ArrowLeft'], [{ ctrlKey: true }, 'Home'], [{ metaKey: true }, 'ArrowRight'], [{ shiftKey: true }, 'End'],
    ];
    for (const [init, key] of cases) {
      const event = await press(tab('Bravo'), key, init);
      expect(selected()).toBe('Bravo');
      expect(event.defaultPrevented).toBe(false);
    }
  });

  it('selects a tab on click', async () => {
    await mount();
    await act(async () => { tab('Charlie').click(); });
    expect(selected()).toBe('Charlie');
    expect(host!.querySelector('[role="tabpanel"]')?.textContent).toBe('c');
  });
});
