import * as React from 'react';
import { useState } from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigurePanel } from '../components/ConfigurePanel';
import { ThemeProvider } from '../contexts/ThemeContext';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import { validate } from '../services/ValidationService';
import type { MetadataService } from '../services/MetadataService';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function makeMetadataService(overrides: Partial<MetadataService> = {}): MetadataService {
  return {
    listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
    listAccessibleDashboards: vi.fn().mockResolvedValue({ status: 'ok', dashboards: [] }),
    listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
    invalidate: vi.fn(),
    ...overrides,
  } as unknown as MetadataService;
}

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(<ThemeProvider>{element}</ThemeProvider>);
  });
}

async function expandSection(title: string) {
  const sectionBtn = Array.from(host?.querySelectorAll('button') ?? []).find(
    b => b.textContent?.includes(title)
  );
  if (sectionBtn?.getAttribute('aria-expanded') === 'false') {
    await act(async () => {
      sectionBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
}

function getChoiceButton(label: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll('[role="radio"]') ?? []).find(
    b => b.textContent?.includes(label)
  ) as HTMLButtonElement | undefined;
}

function findToggleByLabel(label: string): HTMLElement | undefined {
  return Array.from(host?.querySelectorAll('[role="switch"]') ?? []).find(
    el => el.getAttribute('aria-label') === label
  ) as HTMLElement | undefined;
}

function findInputByPlaceholder(placeholder: string): HTMLInputElement | undefined {
  return (host?.querySelector(`input[placeholder="${placeholder}"]`) ?? undefined) as HTMLInputElement | undefined;
}

async function renderPanel({
  config,
  onChange,
}: {
  config?: PaneDefinitionConfig;
  onChange?: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
} = {}) {
  const useStateful = config === undefined && onChange === undefined;

  if (useStateful) {
    await render(
      <StatefulConfigurePanel
        initialConfig={DEFAULT_CONFIG}
        metadataService={makeMetadataService()}
      />
    );
  } else {
    await render(
      <ConfigurePanel
        config={config ?? DEFAULT_CONFIG}
        onChange={onChange ?? vi.fn()}
        validation={validate(config ?? DEFAULT_CONFIG)}
        metadataService={makeMetadataService()}
      />
    );
  }
  await expandSection('Record context');
  await expandSection('Advanced options');
}

function StatefulConfigurePanel({
  initialConfig,
  metadataService,
}: {
  initialConfig: PaneDefinitionConfig;
  metadataService: MetadataService;
}): React.ReactElement {
  const [config, setConfig] = useState(initialConfig);
  const validation = validate(config);
  return (
    <ConfigurePanel
      config={config}
      onChange={updater => setConfig(prev => updater(prev))}
      validation={validation}
      metadataService={metadataService}
    />
  );
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

describe('ConfigurePanel', () => {
  it('renders dashboard and search as enabled choices', async () => {
    await render(
      <ConfigurePanel
        config={DEFAULT_CONFIG}
        onChange={() => {}}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={makeMetadataService()}
      />
    );
    await expandSection('What opens in the pane');

    const dashboardBtn = getChoiceButton('Dashboard');
    const searchBtn = getChoiceButton('Search');

    expect(dashboardBtn).toBeTruthy();
    expect(dashboardBtn?.disabled).toBe(false);
    expect(searchBtn).toBeTruthy();
    expect(searchBtn?.disabled).toBe(false);
  });

  it('shows DashboardPicker when dashboard page type is selected', async () => {
    const listAccessibleDashboards = vi.fn().mockResolvedValue({ status: 'ok', dashboards: [] });
    const metadataService = makeMetadataService({ listAccessibleDashboards } as Partial<MetadataService>);
    await render(
      <StatefulConfigurePanel
        initialConfig={DEFAULT_CONFIG}
        metadataService={metadataService}
      />
    );
    await expandSection('What opens in the pane');

    const dashboardBtn = getChoiceButton('Dashboard');
    expect(dashboardBtn).toBeTruthy();

    await act(async () => {
      dashboardBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Field shows error instead of hint because dashboardId is empty
    expect(host?.textContent).toContain('Dashboard is required');
    expect(listAccessibleDashboards).toHaveBeenCalled();
  });

  it('shows search text input when search page type is selected', async () => {
    await render(
      <StatefulConfigurePanel
        initialConfig={DEFAULT_CONFIG}
        metadataService={makeMetadataService()}
      />
    );
    await expandSection('What opens in the pane');

    const searchBtn = getChoiceButton('Search');
    expect(searchBtn).toBeTruthy();

    await act(async () => {
      searchBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(host?.textContent).toContain('Search text');
    expect(host?.textContent).toContain('Pre-fill the global search box');
  });

  it('emits updated config when search text changes', async () => {
    const onChange = vi.fn();
    await render(
      <ConfigurePanel
        config={{ ...DEFAULT_CONFIG, target: { pageType: 'search', searchText: '' } }}
        onChange={onChange}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={makeMetadataService()}
      />
    );
    await expandSection('What opens in the pane');

    const input = host?.querySelector('input[placeholder="e.g. Contoso"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const inputValueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    await act(async () => {
      inputValueDescriptor?.set?.call(input, 'Contoso');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const next = updater({ ...DEFAULT_CONFIG, target: { pageType: 'search', searchText: '' } });
    expect(next.target).toEqual({ pageType: 'search', searchText: 'Contoso' });
  });

  it('displays dashboard validation error when dashboardId is empty', async () => {
    const config = { ...DEFAULT_CONFIG, target: { pageType: 'dashboard' as const, dashboardId: '', dashboardName: '' } };
    const validation = validate(config);
    expect(validation.errors.some(e => e.field === 'target.dashboardId')).toBe(true);

    await render(
      <ConfigurePanel
        config={config}
        onChange={() => {}}
        validation={validation}
        metadataService={makeMetadataService()}
      />
    );
    await expandSection('What opens in the pane');

    expect(host?.textContent).toContain('Dashboard is required');
  });

  it('resets target fields when switching page types', async () => {
    const onChange = vi.fn();
    await render(
      <ConfigurePanel
        config={{ ...DEFAULT_CONFIG, target: { pageType: 'custom', name: 'sps_MyPage' } }}
        onChange={onChange}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={makeMetadataService()}
      />
    );
    await expandSection('What opens in the pane');

    const searchBtn = getChoiceButton('Search');
    await act(async () => {
      searchBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const next = updater({ ...DEFAULT_CONFIG, target: { pageType: 'custom', name: 'sps_MyPage' } });
    expect(next.target).toEqual({ pageType: 'search', searchText: '' });
  });

  it('renders metadata filter editor in advanced options when handlers are provided', async () => {
    await render(
      <ConfigurePanel
        config={DEFAULT_CONFIG}
        onChange={() => {}}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={makeMetadataService()}
        metadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
        defaultMetadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
        metadataFilterPersistenceAvailable={true}
        onSaveMetadataFilterConfig={() => {}}
        onResetMetadataFilterConfig={() => {}}
      />
    );
    await expandSection('Advanced options');

    expect(host?.textContent).toContain('Metadata table filters');
    expect(host?.textContent).toContain('Deny prefixes');
    expect(host?.textContent).toContain('Allowed standard tables');
  });

  it('orders advanced pane settings before metadata filters', async () => {
    await render(
      <ConfigurePanel
        config={DEFAULT_CONFIG}
        onChange={() => {}}
        validation={{ isValid: true, errors: [], warnings: [] }}
        metadataService={makeMetadataService()}
        metadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
        defaultMetadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
        metadataFilterPersistenceAvailable={true}
        onSaveMetadataFilterConfig={() => {}}
        onResetMetadataFilterConfig={() => {}}
      />
    );
    await expandSection('Advanced options');

    const text = host?.textContent ?? '';
    expect(text.indexOf('Open in foreground (isSelected)')).toBeLessThan(text.indexOf('Keep loaded when inactive'));
    expect(text.indexOf('Initial badge value')).toBeLessThan(text.indexOf('Metadata table filters'));
  });
});

describe('ConfigurePanel behavior controls', () => {
  it('renders a control for every behavior field the generator consumes', async () => {
    const onChange = vi.fn();
    await renderPanel({ config: DEFAULT_CONFIG, onChange: onChange });

    const expand = findToggleByLabel('Expand pane on open');
    const closeOthers = findToggleByLabel('Close other side panes');
    expect(expand).toBeTruthy();
    expect(closeOthers).toBeTruthy();

    await act(async () => { closeOthers!.click(); });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0](DEFAULT_CONFIG);
    expect(next.behavior.closeOthers).toBe(true);
  });

  it('exposes the static record ID field for ManualJS + entityrecord', async () => {
    const config: PaneDefinitionConfig = {
      ...DEFAULT_CONFIG,
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      trigger: { ...DEFAULT_CONFIG.trigger, kind: 'ManualJS' },
      context: { ...DEFAULT_CONFIG.context, mode: 'CurrentRecord' },
    };
    await renderPanel({ config, onChange: vi.fn() });

    expect(findInputByPlaceholder('00000000-0000-0000-0000-000000000000')).toBeTruthy();
  });
});

describe('ConfigurePanel — pane appearance (WR-002)', () => {
  it('offers no Resizable toggle, because isResizable is not a documented paneOption', async () => {
    await renderPanel({ config: DEFAULT_CONFIG, onChange: vi.fn() });
    await expandSection('Pane Appearance');
    expect(host?.textContent ?? '').not.toMatch(/resizable/i);
  });

  it('tells makers the tab icon needs the WebResources/ prefix', async () => {
    await renderPanel({ config: DEFAULT_CONFIG, onChange: vi.fn() });
    await expandSection('Pane Appearance');
    expect(findInputByPlaceholder('WebResources/sps_/icons/myicon.svg')).toBeTruthy();
  });

  it('surfaces the hideHeader warning as a warn callout, not an error', async () => {
    const config = DEFAULT_CONFIG;
    const validation = {
      errors: [] as Array<{ field: string; message: string }>,
      warnings: [{ field: 'pane.hideHeader', message: 'Hiding the header also hides the close button.' }],
      isValid: true,
    };
    await render(
      <ConfigurePanel
        config={config}
        onChange={vi.fn()}
        validation={validation}
        metadataService={makeMetadataService()}
      />
    );
    await expandSection('Pane Appearance');

    expect(host?.textContent ?? '').toMatch(/hides the close button/i);
  });
});

describe('ConfigurePanel — search target (WR-001)', () => {
  it('shows the search warning callout when the search page type is selected', async () => {
    const config = { ...DEFAULT_CONFIG, target: { pageType: 'search' as const, searchText: '' } };
    const validation = {
      errors: [] as Array<{ field: string; message: string }>,
      warnings: [{ field: 'target.pageType', message: 'Search is not a documented navigateTo pageType.' }],
      isValid: true,
    };
    await render(
      <ConfigurePanel
        config={config}
        onChange={vi.fn()}
        validation={validation}
        metadataService={makeMetadataService()}
      />
    );
    await expandSection('What opens in the pane');

    expect(host?.textContent ?? '').toMatch(/not a documented navigateTo pageType/i);
  });

  it('labels the search option as unsupported in the content type list', async () => {
    await renderPanel();
    await expandSection('What opens in the pane');

    const searchBtn = getChoiceButton('Search');
    await act(async () => {
      searchBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(host?.textContent ?? '').toMatch(/not documented by navigateTo/i);
  });

  it('shows no search warning for a custom page target', async () => {
    await renderPanel();
    await expandSection('What opens in the pane');
    expect(host?.textContent ?? '').not.toMatch(/not a documented navigateTo pageType/i);
  });
});

describe('ConfigurePanel — record context table name (CR-001)', () => {
  const withMode = (mode: string, extra: Record<string, unknown> = {}) => ({
    config: {
      ...DEFAULT_CONFIG,
      context: { mode, entityName: '', staticRecordId: '', reuseExistingPane: true },
      ...extra,
    },
  });

  it('offers a table name input on the shipped default (custom + CurrentRecord)', async () => {
    await renderPanel(withMode('CurrentRecord') as any);
    expect(findInputByPlaceholder('account')).toBeTruthy();
  });

  it('offers a table name input for SelectedRow', async () => {
    await renderPanel(withMode('SelectedRow') as any);
    expect(findInputByPlaceholder('account')).toBeTruthy();
  });

  it('offers a table name input for Static', async () => {
    await renderPanel(withMode('Static') as any);
    expect(findInputByPlaceholder('account')).toBeTruthy();
  });

  it('hides the table name input for None, which emits no record fields', async () => {
    await renderPanel(withMode('None') as any);
    expect(findInputByPlaceholder('account')).toBeUndefined();
  });

  it('shows the Record ID input only for Static', async () => {
    await renderPanel(withMode('Static') as any);
    expect(findInputByPlaceholder('00000000-0000-0000-0000-000000000000')).toBeTruthy();
  });

  it('hides the Record ID input for CurrentRecord, which resolves the id at runtime', async () => {
    await renderPanel(withMode('CurrentRecord') as any);
    expect(findInputByPlaceholder('00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });

  it('still shows the Record ID input for ManualJS + entityrecord', async () => {
    await renderPanel(
      withMode('None', {
        trigger: { kind: 'ManualJS', functionName: 'openPane', namespace: 'Ns', fieldName: '' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      }) as any
    );
    expect(findInputByPlaceholder('00000000-0000-0000-0000-000000000000')).toBeTruthy();
  });
});
