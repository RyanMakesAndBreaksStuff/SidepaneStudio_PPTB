import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { FormXmlRenderer } from '../components/FormXmlRenderer';
import { ThemeProvider } from '../contexts/ThemeContext';
import type { FormModel } from '../services/FormXmlService';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

const tab = (name: string, label: string) => ({ name, label, sections: [] });

async function render(model: FormModel) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<ThemeProvider><FormXmlRenderer model={model} /></ThemeProvider>); });
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('FormXmlRenderer tabs (revie2 WR-009)', () => {
  it('exposes the form tabs as a tablist tied to its panel, with one tab stop', async () => {
    await render({ tabs: [tab('general', 'General'), tab('details', 'Details')] });
    const tabs = Array.from(host!.querySelectorAll<HTMLButtonElement>('[role="tablist"] [role="tab"]'));
    expect(tabs.map(t => t.textContent)).toEqual(['General', 'Details']);
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map(t => t.tabIndex)).toEqual([0, -1]);
    const panel = host!.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
  });

  it('moves to the next tab with the right arrow', async () => {
    await render({ tabs: [tab('general', 'General'), tab('details', 'Details')] });
    const first = host!.querySelector<HTMLButtonElement>('[role="tab"]')!;
    await act(async () => { first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    const tabs = Array.from(host!.querySelectorAll('[role="tab"]'));
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
  });

  it('draws no tab strip and no tabpanel role for a single tab', async () => {
    await render({ tabs: [tab('general', 'General')] });
    expect(host!.querySelector('[role="tablist"]')).toBeNull();
    expect(host!.querySelector('[role="tabpanel"]')).toBeNull();
  });
});
