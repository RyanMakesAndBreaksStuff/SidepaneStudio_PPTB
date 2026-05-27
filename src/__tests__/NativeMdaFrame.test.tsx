import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { NativeMdaFrame } from '../components/NativeMdaFrame';
import { FormModel } from '../services/FormXmlService';
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

const mockTarget = {
  pageType: 'entityrecord' as const,
  name: '',
  entityName: 'account',
  entityId: '',
};

const contactTarget = {
  pageType: 'entityrecord' as const,
  name: '',
  entityName: 'contact',
  entityId: '',
};

const mockValidation = { isValid: true, errors: [], warnings: [] };

function makeFormModel(entityName: string): FormModel {
  return {
    tabs: [
      {
        name: 'tab_summary',
        label: 'Summary',
        expanded: true,
        sections: [
          {
            name: 'sec_main',
            label: `${entityName} Information`,
            showLabel: true,
            columnCount: 1,
            rows: [
              {
                cells: [
                  {
                    label: 'Name',
                    fieldName: 'name',
                    fieldType: 'text' as const,
                    colspan: 1,
                    empty: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('NativeMdaFrame', () => {
  it('renders static mock header when formModel is not provided', async () => {
    await render(
      <NativeMdaFrame
        pane={DEFAULT_CONFIG.pane}
        hostTarget={mockTarget}
        paneTarget={DEFAULT_CONFIG.target}
        validation={mockValidation}
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

  it('renders dynamic entity header when formModel is provided', async () => {
    await render(
      <NativeMdaFrame
        pane={DEFAULT_CONFIG.pane}
        hostTarget={contactTarget}
        paneTarget={DEFAULT_CONFIG.target}
        validation={mockValidation}
        formModel={makeFormModel('contact')}
      >
        <div>Content</div>
      </NativeMdaFrame>
    );

    expect(host?.textContent).toContain('Contact (sample)');
    expect(host?.textContent).toContain('CO');
    expect(host?.textContent).toContain('contact · Contact');
  });

  it('hides static stats and tabs when formModel is provided', async () => {
    await render(
      <NativeMdaFrame
        pane={DEFAULT_CONFIG.pane}
        hostTarget={contactTarget}
        paneTarget={DEFAULT_CONFIG.target}
        validation={mockValidation}
        formModel={makeFormModel('contact')}
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
    const multiWordTarget = {
      pageType: 'entityrecord' as const,
      name: '',
      entityName: 'sales order',
      entityId: '',
    };

    await render(
      <NativeMdaFrame
        pane={DEFAULT_CONFIG.pane}
        hostTarget={multiWordTarget}
        paneTarget={DEFAULT_CONFIG.target}
        validation={mockValidation}
        formModel={makeFormModel('salesorder')}
      >
        <div>Content</div>
      </NativeMdaFrame>
    );

    expect(host?.textContent).toContain('SO');
    expect(host?.textContent).toContain('Sales order (sample)');
  });
});
