import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchShell } from '../components/WorkbenchShell';
import { IXrmContext } from '../adapters/PptbContextAdapter';
import { MetadataService } from '../services/MetadataService';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function xrmStub(): IXrmContext {
  return {
    isAvailable: true,
    sidePanesAvailable: true,
    createPane: vi.fn(),
    getPane: vi.fn(),
    getHostKind: () => 'Unknown',
    checkWebResourceExists: vi.fn().mockResolvedValue(true),
    readEnvVar: vi.fn().mockResolvedValue(null),
    getCurrentAppId: vi.fn(() => null),
    getCurrentUserId: vi.fn().mockResolvedValue('user-1'),
    webApiGet: vi.fn(),
    dataverseExecute: vi.fn(),
    getAllEntitiesMetadata: vi.fn().mockResolvedValue([]),
  };
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
    expect(sections?.[0].style.minWidth).toBe('300px');
    expect(sections?.[1].style.width).toBe('420px');
    expect(sections?.[1].style.minWidth).toBe('360px');
  });
});
