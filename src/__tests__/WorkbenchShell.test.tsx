import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchShell } from '../components/WorkbenchShell';
import { MetadataService } from '../services/MetadataService';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import { xrmStub } from './testHelpers';

vi.mock('../components/CommandBar', () => ({
  CommandBar: () => <div>Command bar</div>,
}));

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
  host?.remove();
  root = undefined;
  host = undefined;
});

// Layout pixel constants for WorkbenchShell wide-mode columns
const PREVIEW_COL_MIN_W = '300px';
const GENERATOR_COL_WIDTH = '420px';
const GENERATOR_COL_MIN_W = '360px';
const COLLAPSED_RAIL_WIDTH = '44px';

function shell(layoutMode: 'wide' | 'narrow' = 'wide') {
  return (
    <WorkbenchShell
      config={DEFAULT_CONFIG}
      onChange={() => {}}
      onReset={() => {}}
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

  it('keeps narrow mode on the existing tab layout', async () => {
    await render(shell('narrow'));

    expect(host?.querySelector('[role="tablist"]')).toBeTruthy();
    expect(host?.textContent).toContain('Configure');
    expect(button('Collapse config panel')).toBeUndefined();
    expect(button('Collapse code panel')).toBeUndefined();
  });
});
