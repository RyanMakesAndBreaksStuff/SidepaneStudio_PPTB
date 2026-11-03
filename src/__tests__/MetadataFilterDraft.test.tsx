import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real shell, panel, Pane & behaviour section and editor; only the preview and output columns are stubbed.
vi.mock('../components/PreviewPanel', () => ({ PreviewPanel: () => null }));
vi.mock('../components/OutputPanel', () => ({ OutputPanel: () => null }));

import { SidePaneBuilderWorkbench } from '../SidePaneBuilderWorkbench';

type Handler = (event: unknown, payload: ToolBoxAPI.ToolBoxEventPayload) => void;
let handler: Handler | undefined;
let settingsSet: ReturnType<typeof vi.fn>;
let root: Root | undefined;
let host: HTMLDivElement | undefined;

const DRAFT = '["abc_"]';

function area(): HTMLTextAreaElement | null {
  return host?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Deny prefixes"]') ?? null;
}

function button(text: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(item => item.textContent === text);
}

/** Opens Pane & behaviour, which every ConfigurePanel mount starts collapsed. */
async function openPaneSection(): Promise<HTMLButtonElement> {
  const header = Array.from(host!.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))
    .find(item => item.textContent?.includes('Pane & behaviour'))!;
  if (header.getAttribute('aria-expanded') === 'false') await act(async () => { header.click(); });
  return header;
}

async function flush(): Promise<void> {
  await act(async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); });
}

async function typeDraft(): Promise<void> {
  const element = area()!;
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.bind(element);
  await act(async () => { setValue?.(DRAFT); element.dispatchEvent(new Event('input', { bubbles: true })); });
}

beforeEach(async () => {
  handler = undefined;
  settingsSet = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('toolboxAPI', {
    connections: { getActiveConnection: vi.fn().mockResolvedValue({ id: 'conn-1' }) },
    events: { on: vi.fn((callback: Handler) => { handler = callback; }), off: vi.fn() },
    settings: { get: vi.fn().mockResolvedValue(null), getAll: vi.fn().mockResolvedValue({}), set: settingsSet },
  });
  vi.stubGlobal('dataverseAPI', { queryData: vi.fn().mockResolvedValue({ value: [] }) });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<SidePaneBuilderWorkbench />); });
  await flush();
  await openPaneSection();
});

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  vi.unstubAllGlobals();
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('metadata filter draft', () => {
  it('survives collapsing and expanding its section', async () => {
    await typeDraft();
    const header = await openPaneSection();
    await act(async () => { header.click(); });
    expect(area()).toBeNull();
    await act(async () => { header.click(); });
    expect(area()?.value).toBe(DRAFT);
    expect(button('Save')).toBeTruthy();
  });

  it('survives the workbench remount a connection event causes', async () => {
    await typeDraft();
    const before = area();
    await act(async () => {
      handler!({ senderId: 'ipc' }, { event: 'connection:updated', data: null, timestamp: new Date().toISOString() });
    });
    await flush();
    await openPaneSection();
    expect(area()).not.toBe(before);
    expect(area()?.value).toBe(DRAFT);
    expect(button('Save')).toBeTruthy();
  });

  it('is replaced by the saved config once a save lands', async () => {
    await typeDraft();
    await act(async () => { button('Save')?.click(); });
    await flush();
    expect(settingsSet).toHaveBeenCalledWith('metadataFilters.denyPrefixes', ['abc_']);
    expect(JSON.parse(area()!.value)).toEqual(['abc_']);
    expect(button('Save')).toBeUndefined();
  });
});
