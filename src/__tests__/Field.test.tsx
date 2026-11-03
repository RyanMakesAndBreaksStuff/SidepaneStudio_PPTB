import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { JsonDataField } from '../components/JsonDataField';
import { Callout } from '../components/Callout';
import { ConfigurePanel } from '../components/ConfigurePanel';
import { ThemeProvider } from '../contexts/ThemeContext';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { validate } from '../services/ValidationService';
import type { MetadataService } from '../services/MetadataService';
import { cfg } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(<ThemeProvider>{element}</ThemeProvider>); });
}

/** Controls a label names, as Testing Library's getByLabelText resolves them: label[for], wrapping label, aria-label. */
function labelled(scope: HTMLElement, text: string): HTMLElement[] {
  const found = new Set<HTMLElement>();
  for (const label of Array.from(scope.querySelectorAll('label'))) {
    if (label.textContent?.trim() !== text) continue;
    const control = label.htmlFor ? document.getElementById(label.htmlFor)
      : label.querySelector<HTMLElement>('input, textarea, select, button');
    if (control) found.add(control);
  }
  scope.querySelectorAll<HTMLElement>('[aria-label]').forEach(element => {
    if (element.getAttribute('aria-label') === text) found.add(element);
  });
  return [...found];
}

function getByLabelText(text: string): HTMLElement {
  const found = labelled(host!, text);
  if (found.length !== 1) throw new Error(`Expected one control labelled "${text}", found ${found.length}`);
  return found[0];
}

function describedText(control: HTMLElement): string {
  return (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
    .map(id => document.getElementById(id)?.textContent ?? '').join(' ');
}

function makeMetadataService(): MetadataService {
  return {
    listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
    listAccessibleDashboards: vi.fn().mockResolvedValue({ status: 'ok', dashboards: [] }),
    listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }),
    listLookupAttributes: vi.fn().mockResolvedValue([]),
    listAttributeLabels: vi.fn().mockResolvedValue([]),
    invalidate: vi.fn(),
    subscribeTables: vi.fn(() => () => undefined),
  } as unknown as MetadataService;
}

async function renderPanel(config: PaneDefinitionConfig): Promise<void> {
  await render(<ConfigurePanel config={config} onChange={vi.fn()} validation={validate(config)}
    metadataService={makeMetadataService()} metadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
    defaultMetadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG} metadataFilterPersistenceAvailable
    onSaveMetadataFilterConfig={vi.fn()} onResetMetadataFilterConfig={vi.fn()} />);
  for (const button of Array.from(host!.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'))) {
    await act(async () => { button.click(); });
  }
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('Field — label, description and validity wiring', () => {
  it('labels a wrapped Input and describes it with the hint', async () => {
    await render(<Field label="Pane title" hint="Shown in the pane header"><Input value="" onChange={vi.fn()} /></Field>);
    const control = getByLabelText('Pane title');
    expect(control.tagName).toBe('INPUT');
    expect(control.getAttribute('aria-invalid')).toBeNull();
    expect(describedText(control)).toBe('Shown in the pane header');
  });

  it('marks an invalid wrapped Input and points its description at the error text', async () => {
    await render(<Field label="Unique pane ID" required hint="Stable key" error="Pane ID is required">
      <div><Input value="" onChange={vi.fn()} /></div>
    </Field>);
    const control = getByLabelText('Unique pane ID *');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(control)).toBe('Pane ID is required');
  });

  it('labels the JSON data textarea and marks it invalid', async () => {
    await render(<JsonDataField label="Page data" hint="Optional JSON" value="{" error="Enter a JSON object" onChange={vi.fn()} />);
    const control = getByLabelText('Page data');
    expect(control.tagName).toBe('TEXTAREA');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(control)).toBe('Enter a JSON object');
  });

  it('announces an error callout and leaves other callouts silent', async () => {
    await render(<><Callout type="err">Broken</Callout><Callout type="warn">Careful</Callout></>);
    const alerts = Array.from(host!.querySelectorAll('[role="alert"]'));
    expect(alerts.map(alert => alert.textContent)).toEqual(['Broken']);
  });
});

describe('Field — configure panel controls resolve by label', () => {
  it('resolves Tab name and Initial badge value', async () => {
    await renderPanel(cfg({ host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } }));
    expect(getByLabelText('Tab name').tagName).toBe('INPUT');
    expect(getByLabelText('Initial badge value')).toMatchObject({ tagName: 'INPUT', type: 'number' });
  });

  it.each([
    ['a table record', cfg({ host: { entityName: 'account' }, context: { source: { kind: 'fixed', entityName: 'account', id: '' } },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } })],
    ['a console generative page', cfg({ trigger: { kind: 'ManualJS', namespace: '' }, context: { source: { kind: 'none' } },
      target: { pageType: 'generative', pageId: '', data: '' } })],
    ['a search with an invalid width', cfg({ pane: { width: 1201, paneId: '' }, target: { pageType: 'search', searchText: '' } })],
  ])('gives every Field-wrapped input of %s an accessible name', async (_name, config) => {
    await renderPanel(config);
    const controls = Array.from(host!.querySelectorAll<HTMLElement>('input, textarea'));
    let checked = 0;
    for (const control of controls) {
      let field: HTMLElement | null = control.parentElement;
      while (field && !field.querySelector(':scope > label')) field = field.parentElement;
      if (!field) continue;
      checked += 1;
      const fieldLabel = field.querySelector(':scope > label')?.textContent?.trim() ?? '';
      const ownLabel = control.getAttribute('aria-label');
      const names = [fieldLabel, ownLabel].filter((text): text is string => !!text);
      expect(names.some(text => labelled(host!, text).includes(control)),
        `${control.outerHTML.slice(0, 80)} in "${fieldLabel}"`).toBe(true);
    }
    expect(checked).toBeGreaterThan(3);
  });
});
