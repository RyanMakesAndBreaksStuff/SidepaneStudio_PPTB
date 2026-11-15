import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchShell } from '../components/WorkbenchShell';
import type { MetadataService } from '../services/MetadataService';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import { xrmStub } from './testHelpers';

// Unlike WorkbenchShell.test.tsx, ConfigurePanel is NOT mocked here: the sentence-strip jump crosses the shell
// and the panel, so only the real pair can show that it opens the rail and the section and is not replayed.
vi.mock('../components/PreviewPanel', () => ({ PreviewPanel: () => <div>Preview panel</div> }));
vi.mock('../components/OutputPanel', () => ({ OutputPanel: () => <div>Output panel</div> }));

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function makeMetadataService(): MetadataService {
  return {
    listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
    listAccessibleDashboards: vi.fn().mockResolvedValue({ status: 'ok', dashboards: [] }),
    listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
    listLookupAttributes: vi.fn().mockResolvedValue([]),
    listAttributeLabels: vi.fn().mockResolvedValue([]),
    invalidate: vi.fn(),
    subscribeTables: vi.fn(() => () => undefined),
  } as unknown as MetadataService;
}

async function render(layoutMode: 'wide' | 'narrow'): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <WorkbenchShell
        config={DEFAULT_CONFIG}
        onChange={() => {}}
        onReset={() => {}}
        xrm={xrmStub()}
        layoutMode={layoutMode}
        metadataService={makeMetadataService()}
        metadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
        defaultMetadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
        metadataFilterPersistenceAvailable={true}
        onSaveMetadataFilterConfig={() => {}}
        onResetMetadataFilterConfig={() => {}}
      />
    );
  });
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  vi.restoreAllMocks();
  host?.remove();
  root = undefined;
  host = undefined;
});

function byLabel(label: string): HTMLButtonElement {
  const found = Array.from(host!.querySelectorAll<HTMLButtonElement>('button')).find(b => b.getAttribute('aria-label') === label);
  if (!found) throw new Error(`Button ${label} was not found`);
  return found;
}

function sectionHeader(title: string): HTMLButtonElement | undefined {
  return Array.from(host!.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))
    .find(button => button.textContent?.includes(title));
}

function tab(label: string): HTMLButtonElement {
  const found = Array.from(host!.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(b => b.textContent === label);
  if (!found) throw new Error(`Tab ${label} was not found`);
  return found;
}

/** The sentence-strip phrase that names the pane, which lives in the section the config rail starts collapsed. */
async function clickPanePhrase(): Promise<void> {
  const phrase = host!.querySelector<HTMLButtonElement>('button[data-slot="pane"]');
  if (!phrase) throw new Error('The pane phrase was not found in the sentence strip');
  await act(async () => { phrase.click(); });
}

describe('WorkbenchShell — sentence strip jump', () => {
  it('opens a collapsed config rail, expands the named section, scrolls to its header and focuses it', async () => {
    const scrolled: Element[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) { scrolled.push(this); });
    await render('wide');
    await act(async () => { byLabel('Collapse config panel').click(); });
    expect(host!.querySelector('aside[aria-label="Config rail"]')).toBeTruthy();

    await clickPanePhrase();

    expect(host!.querySelector('aside[aria-label="Config panel"]')).toBeTruthy();
    const header = sectionHeader('Pane & behaviour');
    expect(header?.getAttribute('aria-expanded')).toBe('true');
    expect(scrolled).toEqual([header]);
    expect(document.activeElement).toBe(header);
  });

  it('does not replay a consumed jump when the config rail is collapsed and reopened', async () => {
    await render('wide');
    await clickPanePhrase();
    expect(sectionHeader('Pane & behaviour')?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => { byLabel('Collapse config panel').click(); });
    await act(async () => { byLabel('Expand config panel').click(); });

    expect(sectionHeader('Pane & behaviour')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not replay a consumed jump when the narrow Configure tab is left and returned to', async () => {
    await render('narrow');
    await clickPanePhrase();
    expect(sectionHeader('Pane & behaviour')?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => { tab('Preview').click(); });
    await act(async () => { tab('Configure').click(); });

    expect(sectionHeader('Pane & behaviour')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('returns to the Configure tab and applies the jump from another narrow tab', async () => {
    await render('narrow');
    await act(async () => { tab('Output').click(); });
    await clickPanePhrase();

    expect(tab('Configure').getAttribute('aria-selected')).toBe('true');
    expect(sectionHeader('Pane & behaviour')?.getAttribute('aria-expanded')).toBe('true');
  });
});
