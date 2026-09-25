import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewPanel } from '../components/PreviewPanel';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { MetadataService } from '../services/MetadataService';
import { cfg, xrmStub } from './testHelpers';

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
        xrm={xrmStub()}
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
        xrm={xrmStub()}
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

  it('shows configured entity-record form and tab parameters in preview metadata', async () => {
    await render(
      <PreviewPanel
        config={{
          ...DEFAULT_CONFIG,
          target: {
            pageType: 'entityrecord',
            entityName: 'account',
            formId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            tabName: 'tab_details',
            data: '',
          },
        }}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={mockMetadataService}
        xrm={xrmStub()}
      />
    );

    expect(host?.textContent).toContain('Form: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(host?.textContent).toContain('Tab: tab_details');
  });
});

describe('PreviewPanel — RelatedRecord Form preview', () => {
  const related = cfg({
    trigger: { kind: 'FormButton' },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
    context: { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' },
  });

  async function openForm(fetchXmlQuery: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('dataverseAPI', { fetchXmlQuery });
    const xrm = { ...xrmStub(),
      webApiGet: vi.fn().mockResolvedValue([{ formid: '11111111-2222-3333-4444-555555555555', name: 'Account' }]),
      webApiGetEntity: vi.fn().mockResolvedValue({ formxml: '<form/>' }) };
    await render(<PreviewPanel config={related} validation={{ isValid: true, errors: [], warnings: [] }}
      metadataService={mockMetadataService} xrm={xrm} />);
    const tab = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Form')!;
    await act(async () => { tab.click(); });
  }

  async function loadSample() {
    const button = Array.from(host!.querySelectorAll('button')).find(b => b.textContent === 'Load sample account record');
    expect(button).toBeTruthy();
    await act(async () => { button!.click(); });
  }

  it('reads one sample source record on request and reveals its lookup record in the pane', async () => {
    const fetchXmlQuery = vi.fn().mockResolvedValue({ value: [{
      _primarycontactid_value: 'contact-id',
      '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Pat Lee',
    }] });
    await openForm(fetchXmlQuery);
    expect(host!.textContent).toContain('Account (sample)');
    expect(fetchXmlQuery).not.toHaveBeenCalled();
    await loadSample();
    const xml = fetchXmlQuery.mock.calls[0][0] as string;
    expect(xml).toContain('<entity name="account">');
    expect(xml).toContain('<condition attribute="primarycontactid" operator="not-null"/>');
    expect(host!.textContent).toContain('Pat Lee · contact-id');
  });

  it('keeps the pane closed when no source record has the lookup set', async () => {
    await openForm(vi.fn().mockResolvedValue({ value: [] }));
    await loadSample();
    expect(host!.textContent).toContain('No account record has a primarycontactid value, so the pane does not open.');
    expect(host!.textContent).not.toContain(related.pane.title);
  });
});
