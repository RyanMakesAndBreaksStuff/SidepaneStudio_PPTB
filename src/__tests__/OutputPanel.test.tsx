import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OutputPanel } from '../components/OutputPanel';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { xrmStub } from './testHelpers';

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

function getLibraryTab() {
  return host?.querySelector('[role="tab"]:nth-child(2)') as HTMLButtonElement | null;
}

async function clickLibraryTab() {
  const tab = getLibraryTab();
  if (!tab) throw new Error('Library tab not found');
  await act(async () => {
    tab.click();
  });
}

describe('OutputPanel', () => {
  it('shows generated FormOnChange entitylist code with double-quoted pageType', async () => {
    const config = {
      ...DEFAULT_CONFIG,
      target: {
        pageType: 'entitylist' as const,
        entityName: 'contact',
      },
      trigger: {
        ...DEFAULT_CONFIG.trigger,
        kind: 'FormOnChange' as const,
        fieldName: 'statuscode',
      },
    };

    await render(
      <OutputPanel
        config={config}
        xrm={xrmStub()}
        validation={{ isValid: true, errors: [], warnings: [] }}
      />
    );

    const pre = host?.querySelector('pre');
    expect(pre?.textContent).toContain('await pane.navigate({ pageType: "entitylist", entityName: "contact" });');
    expect(pre?.textContent).not.toContain('&#39;');
  });

  it('shows prerequisite warning when shared runtime is confirmed missing', async () => {
    const xrm = xrmStub();
    xrm.checkWebResourceExists = vi.fn().mockResolvedValue(false);

    await render(
      <OutputPanel
        config={DEFAULT_CONFIG}
        xrm={xrm}
        validation={{ isValid: true, errors: [], warnings: [] }}
      />
    );

    await clickLibraryTab();
    // wait for effect + promise
    await act(async () => new Promise(r => setTimeout(r, 0)));

    expect(host?.textContent).toContain('Prerequisite not detected');
    expect(host?.textContent).not.toContain('Could not verify prerequisite');
  });

  it('surfaces lookup errors distinctly from missing-prerequisite state', async () => {
    const xrm = xrmStub();
    xrm.checkWebResourceExists = vi.fn().mockRejectedValue(new Error('Host API unreachable'));

    await render(
      <OutputPanel
        config={DEFAULT_CONFIG}
        xrm={xrm}
        validation={{ isValid: true, errors: [], warnings: [] }}
      />
    );

    await clickLibraryTab();
    await act(async () => new Promise(r => setTimeout(r, 0)));

    expect(host?.textContent).toContain('Could not verify prerequisite');
    expect(host?.textContent).toContain('Host API unreachable');
    expect(host?.textContent).not.toContain('Prerequisite not detected');
  });
});
