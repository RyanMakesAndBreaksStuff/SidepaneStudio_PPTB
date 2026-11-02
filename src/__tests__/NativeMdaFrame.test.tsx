import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { NativeMdaFrame } from '../components/NativeMdaFrame';
import type { PreviewRecord } from '../services/GridViewModel';
import { PreviewSizeProvider } from '../components/previewSize';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';

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
  host?.remove();
  root = undefined;
  host = undefined;
});

const mockValidation = { isValid: true, errors: [], warnings: [] };

describe('NativeMdaFrame', () => {
  it('renders the static mock header for the mock variant', async () => {
    await render(
      <NativeMdaFrame
        pane={DEFAULT_CONFIG.pane}
        paneTarget={DEFAULT_CONFIG.target}
        validation={mockValidation}
        variant={{ kind: 'mock' }}
      >
        <div>Content</div>
      </NativeMdaFrame>
    );

    expect(host?.textContent).toContain('Alpine Ski House (sample)');
    expect(host?.textContent).toContain('AS');
    expect(host?.textContent).toContain('Annual Revenue');
    expect(host?.textContent).toContain('Summary');
    expect(host?.textContent).toContain('Details');
    expect(host?.textContent).toContain('Related');
  });

  it('renders the host table header for the form variant', async () => {
    await render(
      <NativeMdaFrame
        pane={DEFAULT_CONFIG.pane}
        paneTarget={DEFAULT_CONFIG.target}
        validation={mockValidation}
        variant={{ kind: 'form', hostEntity: 'contact', record: null }}
      >
        <div>Content</div>
      </NativeMdaFrame>
    );

    expect(host?.textContent).toContain('Contact (sample)');
    expect(host?.textContent).toContain('CO');
    expect(host?.textContent).toContain('contact · Contact');
  });

  it('hides static stats and tabs for the form variant', async () => {
    await render(
      <NativeMdaFrame
        pane={DEFAULT_CONFIG.pane}
        paneTarget={DEFAULT_CONFIG.target}
        validation={mockValidation}
        variant={{ kind: 'form', hostEntity: 'contact', record: null }}
      >
        <div>Content</div>
      </NativeMdaFrame>
    );

    expect(host?.textContent).not.toContain('Alpine Ski House (sample)');
    expect(host?.textContent).not.toContain('Annual Revenue');
    expect(host?.textContent).not.toContain('Number of Employees');
    // The static Summary/Details/Related tabs should not appear;
    // any "Summary" text should only come from the child content.
    const text = host?.textContent ?? '';
    const summaryCount = text.split('Summary').length - 1;
    expect(summaryCount).toBe(0);
  });

  it('uses two-letter initials for multi-word entity names', async () => {
    await render(
      <NativeMdaFrame
        pane={DEFAULT_CONFIG.pane}
        paneTarget={DEFAULT_CONFIG.target}
        validation={mockValidation}
        variant={{ kind: 'form', hostEntity: 'sales order', record: null }}
      >
        <div>Content</div>
      </NativeMdaFrame>
    );

    expect(host?.textContent).toContain('SO');
    expect(host?.textContent).toContain('Sales order (sample)');
  });
});

const relatedRecord: PreviewRecord = { id: 'rec-1', name: 'Pat Lee', entityName: 'contact' };
const recordPaneTarget = { pageType: 'entityrecord' as const, entityName: 'contact', formId: '', tabName: '', data: '' };
const unselectedPane = { ...DEFAULT_CONFIG.pane, isSelected: false };
const gridCaption = 'account · Active Accounts · live data, simulated command';

function atWidth(width: number, element: React.ReactElement): React.ReactElement {
  return <PreviewSizeProvider width={width}>{element}</PreviewSizeProvider>;
}

function mockFrame(pane = DEFAULT_CONFIG.pane): React.ReactElement {
  return (
    <NativeMdaFrame pane={pane} paneTarget={DEFAULT_CONFIG.target} validation={mockValidation} variant={{ kind: 'mock' }}>
      <div>Content</div>
    </NativeMdaFrame>
  );
}

function formFrame(pane = DEFAULT_CONFIG.pane, record: PreviewRecord | null = null): React.ReactElement {
  return (
    <NativeMdaFrame pane={pane} paneTarget={recordPaneTarget} validation={mockValidation}
      variant={{ kind: 'form', hostEntity: 'contact', record }}>
      <div>Content</div>
    </NativeMdaFrame>
  );
}

function gridFrame(pane = DEFAULT_CONFIG.pane, record: PreviewRecord | null = null): React.ReactElement {
  return (
    <NativeMdaFrame pane={pane} paneTarget={recordPaneTarget} validation={mockValidation}
      variant={{ kind: 'grid', caption: gridCaption, record }}>
      <div>Content</div>
    </NativeMdaFrame>
  );
}

describe('NativeMdaFrame rendered output', () => {
  const cases: Array<[string, () => React.ReactElement]> = [
    ['mock host, wide', () => mockFrame()],
    ['mock host, regular', () => atWidth(700, mockFrame())],
    ['mock host with an unselected pane, compact', () => atWidth(400, mockFrame(unselectedPane))],
    ['form host with a sample record, wide', () => formFrame(DEFAULT_CONFIG.pane, relatedRecord)],
    ['form host before a sample loads, regular', () => atWidth(700, formFrame())],
    ['form host whose sample has no related record, wide', () => formFrame(unselectedPane)],
    ['grid host with a related record, wide', () => gridFrame(DEFAULT_CONFIG.pane, relatedRecord)],
    ['grid host with a related record, regular', () => atWidth(700, gridFrame(DEFAULT_CONFIG.pane, relatedRecord))],
    ['grid host with no open pane, compact', () => atWidth(400, gridFrame(unselectedPane))],
  ];

  for (const [name, build] of cases) {
    it(`keeps the recorded markup: ${name}`, async () => {
      await render(build());
      expect(host?.innerHTML).toMatchSnapshot();
    });
  }

  it('stacks the selected pane beneath the host content at compact width', async () => {
    await render(atWidth(400, mockFrame()));

    const text = host?.textContent ?? '';
    expect(text.split('Related Records').length - 1).toBe(1);
    expect(text.indexOf('Content')).toBeLessThan(text.indexOf('Related Records'));
    const title = [...(host?.querySelectorAll('span') ?? [])].find(span => span.textContent === 'Related Records');
    expect(title?.closest('[style*="margin-top: 10px"]')).not.toBeNull();
  });
});
