import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewPanel } from '../components/PreviewPanel';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { MetadataService } from '../services/MetadataService';

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
  vi.unstubAllGlobals();
  host?.remove();
  root = undefined;
  host = undefined;
});

const mockMetadataService = {
  listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
  invalidate: vi.fn(),
} as unknown as MetadataService;

describe('PreviewPanel', () => {
  it('renders mock preview', async () => {
    await render(
      <PreviewPanel
        config={DEFAULT_CONFIG}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={mockMetadataService}
      />
    );

    expect(host?.textContent).toContain('Power Apps');
    expect(host?.textContent).toContain('Side Pane Studio');
    expect(host?.textContent).toContain('Summary');
    expect(host?.textContent).toContain('Timeline');
  });

  it('switches to form mode when Form tab is clicked', async () => {
    await render(
      <PreviewPanel
        config={DEFAULT_CONFIG}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={mockMetadataService}
      />
    );

    const formTab = Array.from(host?.querySelectorAll('button') ?? []).find(
      b => b.textContent === 'Form'
    );
    expect(formTab).toBeTruthy();

    await act(async () => {
      formTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    // In form mode with no entity selected, should show placeholder text
    expect(host?.textContent).toContain('Pick a preview entity');
  });
});
