import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchShell } from '../components/WorkbenchShell';
import { MetadataService } from '../services/MetadataService';
import { DEFAULT_CONFIG, type PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import { theme } from '../theme/tokens';
import { cfg, deferred, rgb, xrmStub } from './testHelpers';

vi.mock('../components/ConfigurePanel', () => ({
  ConfigurePanel: ({ validation }: { validation: { warnings: Array<{ field: string }> } }) => (
    <div>Configure panel<span data-testid="table-warning">{String(validation.warnings.some(warning => warning.field === 'target.entityName'))}</span></div>
  ),
}));

const previewState = vi.hoisted(() => ({ throws: false }));

vi.mock('../components/PreviewPanel', () => ({
  PreviewPanel: () => {
    if (previewState.throws) throw new Error('preview exploded');
    return <div>Preview panel</div>;
  },
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
  previewState.throws = false;
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

describe('WorkbenchShell — accessible tables', () => {
  const table = (logicalName: string, isCustomEntity: boolean) => ({ logicalName, displayName: logicalName, objectTypeCode: 1, isCustomEntity });
  const listOf = (...tables: Array<ReturnType<typeof table>>) => ({ status: 'ok', tables });
  const withTable = (entityName: string) => cfg({ target: { pageType: 'entitylist', entityName, viewId: '', viewType: '' } });
  const warned = () => host?.querySelector('[data-testid="table-warning"]')?.textContent;

  it('flags a table missing from the environment only once the list has loaded', async () => {
    const pending = deferred<unknown>();
    await render(shell('wide', undefined, tablesService(() => pending.promise), withTable('new_gone')));
    expect(warned()).toBe('false');
    await act(async () => { pending.resolve(listOf(table('account', false), table('new_widget', true))); });
    expect(warned()).toBe('true');
  });

  it('accepts a listed table, custom or not', async () => {
    const service = () => tablesService(() => Promise.resolve(listOf(table('account', false), table('new_widget', true))));
    await render(shell('wide', undefined, service(), withTable('account')));
    expect(warned()).toBe('false');
    await render(shell('wide', undefined, service(), withTable('new_widget')));
    expect(warned()).toBe('false');
  });

  it('raises no warning when the table list fails or rejects', async () => {
    await render(shell('wide', undefined, tablesService(() => Promise.resolve({ status: 'error', reason: 'offline' })), withTable('new_gone')));
    expect(warned()).toBe('false');
    await render(shell('wide', undefined, tablesService(() => Promise.reject(new Error('offline'))), withTable('new_gone')));
    expect(warned()).toBe('false');
  });
});

function tablesService(listAccessibleTables: () => Promise<unknown> = () => Promise.resolve({ status: 'ok', tables: [] })): MetadataService {
  return { listAccessibleTables: vi.fn(listAccessibleTables), invalidate: vi.fn(), subscribeTables: vi.fn(() => () => undefined) } as unknown as MetadataService;
}

function shell(layoutMode: 'wide' | 'narrow' = 'wide', onReset: () => void = () => {}, metadataService: MetadataService = tablesService(), config: PaneDefinitionConfig = DEFAULT_CONFIG) {
  return (
    <WorkbenchShell
      config={config}
      onChange={() => {}}
      onReset={onReset}
      xrm={xrmStub()}
      layoutMode={layoutMode}
      metadataService={metadataService}
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

  it('sets the inherited text colour, font and size on the shell root from theme tokens', async () => {
    await render(shell());

    const shellRoot = host!.firstElementChild as HTMLElement;
    const T = theme(true);
    expect(shellRoot.style.color).toBe(rgb(T.fg1));
    expect(shellRoot.style.fontFamily).toContain('Segoe UI Variable Display');
    expect(shellRoot.style.fontSize).toBe('13px');
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

  it('moves between narrow tabs with the arrow keys and ties the selected tab to its panel (r2 WR-011)', async () => {
    await render(shell('narrow'));
    const configure = tab('Configure')!;
    configure.focus();
    await act(async () => { configure.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); });
    expect(tab('Preview')?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Preview'));
    expect(host!.textContent).toContain('Preview panel');
    expect(document.getElementById(tab('Preview')!.getAttribute('aria-controls')!)?.getAttribute('role')).toBe('tabpanel');
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

describe('WorkbenchShell — preview crash containment', () => {
  it.each(['wide', 'narrow'] as const)('keeps the workbench running when the preview throws (%s)', async layout => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    previewState.throws = true;
    await render(shell(layout));
    if (layout === 'narrow') await act(async () => { tab('Preview')?.click(); });

    expect(host?.textContent).toContain('The preview hit an unexpected error');
    expect(host?.textContent).toContain('preview exploded');
    expect(resetButton()).toBeDefined();
    if (layout === 'wide') {
      expect(host?.textContent).toContain('Configure panel');
      expect(host?.textContent).toContain('Output panel');
    }

    previewState.throws = false;
    const tryAgain = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Try again');
    await act(async () => { tryAgain?.click(); });
    expect(host?.textContent).toContain('Preview panel');
  });
});
