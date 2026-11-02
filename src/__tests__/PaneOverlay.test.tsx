import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { PaneOverlay } from '../components/PaneOverlay';
import { getPreviewPaneWidth, getSafePreviewImageSrc } from '../components/previewHelpers';
import type { PreviewRecord } from '../services/GridViewModel';
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

describe('preview helpers', () => {
  it('scales pane widths across the full 300 to 1200 config range', () => {
    // Two-segment linear interpolation: [300→120, 1000→270] then [1000→270, 1200→300]
    expect(getPreviewPaneWidth(300)).toBe(120);
    expect(getPreviewPaneWidth(1000)).toBe(270);
    expect(getPreviewPaneWidth(1200)).toBe(300);
  });

  for (const source of [
    'http://example.test/icon.svg',
    'https://example.test/icon.svg',
    '//example.test/icon.svg',
    'data:image/svg+xml;base64,AAAA',
    'javascript:alert(1)',
  ]) {
    it(`blocks unsafe preview image source ${source}`, () => {
      expect(getSafePreviewImageSrc(source)).toBeNull();
    });
  }
});

describe('PaneOverlay', () => {
  it('renders a generative page with its label, shortened page ID, and no record skeleton', async () => {
    await render(
      <PaneOverlay
        pane={DEFAULT_CONFIG.pane}
        target={{ pageType: 'generative', pageId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', data: '' }}
        validation={{ isValid: true, errors: [], warnings: [] }}
      />
    );
    expect(host?.textContent).toContain('Generative Page');
    expect(host?.textContent).toContain('…eeeeeeee');
    expect(host?.textContent).not.toContain('Email');
  });
  it('does not render an img for blocked image sources', async () => {
    await render(
      <PaneOverlay
        pane={{ ...DEFAULT_CONFIG.pane, imageSrc: 'https://example.test/icon.svg' }}
        target={DEFAULT_CONFIG.target}
        validation={{ isValid: true, errors: [], warnings: [] }}
      />
    );

    expect(host?.querySelector('img')).toBeNull();
  });

  it('labels a create-mode record target as a new record', async () => {
    await render(
      <PaneOverlay
        pane={DEFAULT_CONFIG.pane}
        target={{ pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true }}
        validation={{ isValid: true, errors: [], warnings: [] }}
      />
    );
    expect(host?.textContent).toContain('New contact');
  });

  it('uses the resolved runtime table and record identity ahead of configured destination metadata', async () => {
    const record: PreviewRecord = { id: 'actual-contact-id', name: 'Pat Lee', entityName: 'contact' };
    await render(
      <PaneOverlay
        pane={DEFAULT_CONFIG.pane}
        target={{ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' }}
        record={record}
        validation={{ isValid: true, errors: [], warnings: [] }}
      />
    );

    const recordIdentity = host?.querySelector('[title="actual-contact-id"]');
    expect(recordIdentity?.previousElementSibling?.textContent?.trim()).toBe('contact');
    expect(recordIdentity?.textContent).toContain('Pat Lee · actual-contact-id');
  });
});

describe('PaneOverlay rendered output', () => {
  const targets: Array<React.ComponentProps<typeof PaneOverlay>['target']> = [
    { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
    { pageType: 'entitylist', entityName: 'account', viewId: 'view-1', viewType: 'savedquery' },
    { pageType: 'webresource', name: 'sps_/pane.html' },
    { pageType: 'custom', name: 'sps_SidePaneBuilderPage' },
    { pageType: 'dashboard', dashboardId: 'dash-1', dashboardName: 'Sales Overview' },
    { pageType: 'search', searchText: 'contoso' },
    { pageType: 'generative', pageId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', data: '' },
  ];

  for (const target of targets) {
    it(`keeps the recorded markup for a ${target.pageType} pane`, async () => {
      await render(
        <PaneOverlay
          pane={DEFAULT_CONFIG.pane}
          target={target}
          record={{ id: 'rec-1', name: 'Pat Lee', entityName: 'contact' }}
          validation={{ isValid: true, errors: [], warnings: [{ field: 'width', message: 'Check the width' }] }}
        />
      );
      expect(host?.innerHTML).toMatchSnapshot();
    });
  }

  for (const layout of ['inline', 'stacked'] as const) {
    it(`renders nothing for an unselected pane in ${layout} layout`, async () => {
      await render(
        <PaneOverlay
          pane={{ ...DEFAULT_CONFIG.pane, isSelected: false }}
          target={DEFAULT_CONFIG.target}
          validation={{ isValid: true, errors: [], warnings: [] }}
          layout={layout}
        />
      );
      expect(host?.innerHTML).toBe('');
    });
  }
});
