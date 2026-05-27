import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchShell } from '../components/WorkbenchShell';
import { MetadataService } from '../services/MetadataService';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
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

describe('WorkbenchShell', () => {
  it('uses the reduced preview column minimum to widen the generator column in wide layout', async () => {
    await render(
      <WorkbenchShell
        config={DEFAULT_CONFIG}
        onChange={() => {}}
        onReset={() => {}}
        xrm={xrmStub()}
        layoutMode="wide"
        metadataService={{} as MetadataService}
      />
    );

    const sections = host?.querySelectorAll('section');
    expect(sections?.[0].style.minWidth).toBe(PREVIEW_COL_MIN_W);
    expect(sections?.[1].style.width).toBe(GENERATOR_COL_WIDTH);
    expect(sections?.[1].style.minWidth).toBe(GENERATOR_COL_MIN_W);
  });
});
