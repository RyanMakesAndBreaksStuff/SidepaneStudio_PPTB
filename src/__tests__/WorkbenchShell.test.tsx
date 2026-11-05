import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchShell } from '../components/WorkbenchShell';
import { MetadataService } from '../services/MetadataService';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import { xrmStub } from './testHelpers';

vi.mock('../components/ConfigurePanel', () => ({
  ConfigurePanel: () => <div>Configure panel</div>,
}));

vi.mock('../components/PreviewPanel', () => ({
  PreviewPanel: () => <div>Preview panel</div>,
}));

vi.mock('../components/OutputPanel', () => ({
  OutputPanel: () => <div>Output panel</div>,
}));

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(element);
  });
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  host?.remove();
  root = undefined;
  host = undefined;
});

// Layout pixel constants for WorkbenchShell wide-mode columns
const PREVIEW_COL_MIN_W = '300px';
const GENERATOR_COL_WIDTH = '420px';
const GENERATOR_COL_MIN_W = '360px';
const COLLAPSED_RAIL_WIDTH = '44px';

function shell(layoutMode: 'wide' | 'narrow' = 'wide', onReset: () => void = () => {}) {
  return (
    <WorkbenchShell
      config={DEFAULT_CONFIG}
      onChange={() => {}}
      onReset={onReset}
      xrm={xrmStub()}
      layoutMode={layoutMode}
      metadataService={{} as MetadataService}
      metadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
      defaultMetadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
      metadataFilterPersistenceAvailable={true}
      onSaveMetadataFilterConfig={() => {}}
      onResetMetadataFilterConfig={() => {}}
    />
  );
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll('button') ?? []).find(
    b => b.getAttribute('aria-label') === label
  ) as HTMLButtonElement | undefined;
}

function resetButton(): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll('button') ?? []).find(
    b => (b.textContent ?? '').includes('Reset')
  ) as HTMLButtonElement | undefined;
}

function tab(label: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll('[role="tab"]') ?? []).find(
    b => b.textContent === label
  ) as HTMLButtonElement | undefined;
}

describe('WorkbenchShell', () => {
  it('uses the reduced preview column minimum to widen the generator column in wide layout', async () => {
    await render(shell());

    const sections = host?.querySelectorAll('section');
    expect(sections?.[0].style.minWidth).toBe(PREVIEW_COL_MIN_W);
    expect(sections?.[1].style.width).toBe(GENERATOR_COL_WIDTH);
    expect(sections?.[1].style.minWidth).toBe(GENERATOR_COL_MIN_W);
  });

  it('collapses and expands the config rail independently', async () => {
    await render(shell());

    expect(host?.textContent).toContain('Configure panel');
    await act(async () => {
      button('Collapse config panel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const configRail = host?.querySelector('aside[aria-label="Config rail"]') as HTMLElement;
    expect(configRail.style.width).toBe(COLLAPSED_RAIL_WIDTH);
    expect(host?.textContent).not.toContain('Configure panel');
    expect(host?.textContent).toContain('Preview panel');
    expect(host?.textContent).toContain('Output panel');

    await act(async () => {
      button('Expand config panel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(host?.textContent).toContain('Configure panel');
  });

  it('collapses and expands the code rail independently', async () => {
    await render(shell());

    expect(host?.textContent).toContain('Output panel');
    await act(async () => {
      button('Collapse code panel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const codeRail = host?.querySelector('section[aria-label="Code rail"]') as HTMLElement;
    expect(codeRail.style.width).toBe(COLLAPSED_RAIL_WIDTH);
    expect(host?.textContent).not.toContain('Output panel');
    expect(host?.textContent).toContain('Configure panel');
    expect(host?.textContent).toContain('Preview panel');

    await act(async () => {
      button('Expand code panel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(host?.textContent).toContain('Output panel');
  });

  it('keeps the preview visible when both side rails are collapsed', async () => {
    await render(shell());

    await act(async () => {
      button('Collapse config panel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button('Collapse code panel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(host?.textContent).toContain('Preview panel');
    expect(host?.querySelector('aside[aria-label="Config rail"]')).toBeTruthy();
    expect(host?.querySelector('section[aria-label="Code rail"]')).toBeTruthy();
  });

  it('titles all three panels in wide layout', async () => {
    await render(shell());

    const titles = () => Array.from(host?.querySelectorAll('h2') ?? []).map(h => h.textContent);
    expect(titles()).toEqual(['Configure', 'Preview', 'Output']);
    await act(async () => {
      button('Collapse config panel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(titles()).toEqual(['Preview', 'Output']);
  });

  it('keeps narrow mode on the existing tab layout', async () => {
    await render(shell('narrow'));

    expect(host?.querySelector('[role="tablist"]')).toBeTruthy();
    expect(host?.textContent).toContain('Configure');
    expect(button('Collapse config panel')).toBeUndefined();
    expect(button('Collapse code panel')).toBeUndefined();
  });

  it('renders no in-tool theme toggle', async () => {
    await render(shell());

    const labels = Array.from(host?.querySelectorAll('button') ?? []).map(b => b.textContent ?? '');
    expect(labels.some(l => l.includes('Light') || l.includes('Dark'))).toBe(false);
  });

  it.each(['wide', 'narrow'] as const)('renders the sentence strip above the %s layout with status and Reset on its right', async (mode) => {
    await render(shell(mode));
    const strip = host!.querySelector('[role="region"][aria-label="Configuration summary"]') as HTMLElement;
    expect(strip).toBeTruthy();
    // strip precedes the panel area and is not inside any panel
    expect(host!.querySelector('aside, [role="tablist"]')!.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(strip.closest('aside, section')).toBeNull();
    const status = strip.querySelector('[role="status"]') as HTMLElement;
    const reset = resetButton()!;
    expect(strip.contains(status)).toBe(true);
    expect(strip.contains(reset)).toBe(true);
    expect(strip.style.minHeight).toBe('44px');
    expect(strip.style.display).toBe('flex');
    expect(status.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // no studio title bar (carried over from the replaced Configure-header Reset test)
    expect(host?.querySelector('header')).toBeNull();
    expect(host?.textContent).not.toContain('Side Pane Studio');
  });

  it('keeps the strip and Reset when the config rail collapses and on every narrow tab', async () => {
    await render(shell('wide'));
    await act(async () => {
      button('Collapse config panel')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(resetButton()).toBeTruthy();
    expect(host!.querySelector('aside[aria-label="Config rail"]')!.contains(resetButton()!)).toBe(false);

    await render(shell('narrow'));
    for (const label of ['Preview', 'Output', 'Configure']) {
      await act(async () => { tab(label)?.click(); });
      expect(resetButton()).toBeTruthy();
    }
  });

  it('confirms and resets on Reset click', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const onReset = vi.fn();
    await render(shell('wide', onReset));

    await act(async () => {
      resetButton()?.click();
    });

    expect(window.confirm).toHaveBeenCalledWith('Reset all configuration? This cannot be undone.');
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('does not itself report a success notification on reset', async () => {
    const showNotification = vi.fn();
    vi.stubGlobal('toolboxAPI', {
      utils: { getCurrentTheme: vi.fn().mockResolvedValue('dark'), showNotification },
      events: { on: vi.fn(), off: vi.fn() },
    });
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const onReset = vi.fn();
    await render(shell('wide', onReset));

    await act(async () => {
      resetButton()?.click();
    });

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('does not reset when the confirm dialog is declined', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onReset = vi.fn();
    await render(shell('wide', onReset));

    await act(async () => {
      resetButton()?.click();
    });

    expect(onReset).not.toHaveBeenCalled();
  });
});
