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
});
