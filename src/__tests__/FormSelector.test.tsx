import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormSelector } from '../components/FormSelector';
import { PreviewSessionProvider } from '../contexts/PreviewSessionContext';
import { FormXmlService } from '../services/FormXmlService';
import { MetadataService, TableInfo } from '../services/MetadataService';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import { deferred } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(element);
  });
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  host?.remove();
  root = undefined;
  host = undefined;
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

const mockMetadataService = {
  listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
  invalidate: vi.fn(),
  subscribeTables: vi.fn(() => () => undefined),
} as unknown as MetadataService;

type TableListResult =
  | { status: 'ok'; tables: TableInfo[] }
  | { status: 'error'; reason: string };

type FormLoadResult = { ok: true; forms: { id: string; name: string }[] };

const accountTable: TableInfo = { logicalName: 'account', displayName: 'Account', objectTypeCode: 1, isCustomEntity: false };
const contactTable: TableInfo = { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2, isCustomEntity: false };
const widgetTable: TableInfo = { logicalName: 'new_widget', displayName: 'Widget', objectTypeCode: 100, isCustomEntity: true };
const eventTable: TableInfo = { logicalName: 'new_event', displayName: 'Event', objectTypeCode: 10001, isCustomEntity: true };

function tableService(load: () => Promise<TableListResult>) {
  const listeners = new Set<() => void>();
  const listAccessibleTables = vi.fn(load);
  const service = {
    listAccessibleTables,
    invalidate: vi.fn(),
    subscribeTables: vi.fn((callback: () => void) => {
      listeners.add(callback);
      return () => { listeners.delete(callback); };
    }),
  };
  return { service, listeners, listAccessibleTables };
}

function queuedTables() {
  const results: Array<ReturnType<typeof deferred<TableListResult>>> = [];
  const handle = tableService(() => {
    const next = deferred<TableListResult>();
    results.push(next);
    return next.promise;
  });
  return { ...handle, results };
}

function formXml(load: (entity: string) => Promise<FormLoadResult>) {
  return { getFormsForEntityResult: vi.fn(load) } as unknown as FormXmlService;
}

const idleForms = formXml(() => Promise.resolve({ ok: true, forms: [] }));

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

function customOnlyButtons() {
  return Array.from(host?.querySelectorAll('button') ?? [])
    .filter(button => button.textContent === 'Only Custom Tables');
}

async function openCombo(index = 0) {
  const combo = host?.querySelectorAll<HTMLInputElement>('[role="combobox"]')[index];
  expect(combo, 'preview combobox').toBeTruthy();
  await act(async () => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    combo?.blur();
    combo?.click();
  });
  return Array.from(host?.querySelectorAll('[role="option"]') ?? []).map(option => option.textContent ?? '').join('\n');
}

describe('FormSelector', () => {
  it('shows load failure and retries to recovered form data', async () => {
    const getFormsForEntityResult = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'query-failed', message: 'offline' } })
      .mockResolvedValueOnce({ ok: true, forms: [{ id: 'form-1', name: 'Main Form' }] });
    const formXmlService = {
      getFormsForEntityResult,
    } as unknown as FormXmlService;
    const onFormSelected = vi.fn();
    const onEntityNameChange = vi.fn();

    await render(
      <FormSelector
        entityName="account"
        onEntityNameChange={onEntityNameChange}
        formXmlService={formXmlService}
        metadataService={mockMetadataService}
        onFormSelected={onFormSelected}
      />
    );
    await act(async () => { await Promise.resolve(); });

    expect(host?.textContent).toContain('Could not load main forms');
    const retryButton = Array.from(host?.querySelectorAll('button') ?? []).find(
      b => b.textContent?.includes('Retry')
    );
    expect(retryButton).toBeTruthy();

    await act(async () => {
      retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(getFormsForEntityResult).toHaveBeenCalledTimes(2);
    expect(host?.textContent).toContain('Main Form');
    expect(host?.textContent).not.toContain('Could not load main forms');
  });

  it('validates error payload shape on failed load', async () => {
    const getFormsForEntityResult = vi.fn().mockResolvedValueOnce({
      ok: false,
      error: { code: 'query-failed', message: 'offline' },
    });
    const formXmlService = {
      getFormsForEntityResult,
    } as unknown as FormXmlService;
    const onFormSelected = vi.fn();
    const onEntityNameChange = vi.fn();

    await render(
      <FormSelector
        entityName="account"
        onEntityNameChange={onEntityNameChange}
        formXmlService={formXmlService}
        metadataService={mockMetadataService}
        onFormSelected={onFormSelected}
      />
    );
    await act(async () => { await Promise.resolve(); });

    const result = await getFormsForEntityResult.mock.results[0].value;
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('query-failed');
    expect(result.error.message).toBe('offline');
    expect(host?.textContent).toContain('Could not load main forms');
    expect(getFormsForEntityResult).toHaveBeenCalledWith('account');
  });

  it('keeps a controlled default form until the user selects and follows external resets', async () => {
    const getFormsForEntityResult = vi.fn().mockResolvedValue({ ok: true, forms: [{ id: 'form-1', name: 'Main Form' }] });
    const formXmlService = { getFormsForEntityResult } as unknown as FormXmlService;
    const onFormSelected = vi.fn();
    const element = (selectedFormId: string) => <FormSelector
      entityName="account" onEntityNameChange={vi.fn()} formXmlService={formXmlService}
      metadataService={mockMetadataService} onFormSelected={onFormSelected}
      selectedFormId={selectedFormId} hideEntityPicker />;
    await render(element(''));
    expect(onFormSelected).not.toHaveBeenCalled();
    expect(host?.textContent).not.toContain('Preview Entity');
    const select = host!.querySelector<HTMLSelectElement>('select[aria-label="Form"]')!;
    expect(select.value).toBe('');
    await act(async () => {
      select.value = 'form-1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onFormSelected).toHaveBeenCalledWith({ entityLogicalName: 'account', formId: 'form-1' });
    await act(async () => root!.render(element('form-1')));
    expect(select.value).toBe('form-1');
    await act(async () => root!.render(element('')));
    expect(select.value).toBe('');
    expect(getFormsForEntityResult).toHaveBeenCalledTimes(1);
  });

  it('names the configured host table when the preview entity diverges', async () => {
    const formXmlService = {
      getFormsForEntityResult: vi.fn().mockResolvedValue({ ok: true, forms: [] }),
    } as unknown as FormXmlService;
    await render(
      <FormSelector entityName="contact" onEntityNameChange={vi.fn()} configuredEntity="account"
        formXmlService={formXmlService} metadataService={mockMetadataService} onFormSelected={vi.fn()} />
    );
    const chip = Array.from(host!.querySelectorAll('span[title]')).find(span => span.textContent === 'diverged');
    expect(chip?.getAttribute('title'))
      .toBe('Preview is showing a different entity than the configured host table (account).');
  });

  it('reloads its table list when the filter configuration changes', async () => {
    const webApiGet = vi.fn().mockResolvedValue([]);
    const metadata = new MetadataService({ webApiGet });
    const formXmlService = {
      getFormsForEntityResult: vi.fn().mockResolvedValue({ ok: true, forms: [] }),
    } as unknown as FormXmlService;
    await render(
      <FormSelector entityName="" onEntityNameChange={vi.fn()} formXmlService={formXmlService}
        metadataService={metadata} onFormSelected={vi.fn()} />
    );
    await act(async () => { await Promise.resolve(); });
    expect(webApiGet).toHaveBeenCalledTimes(1);

    await act(async () => {
      metadata.setFilterConfig({ ...DEFAULT_METADATA_FILTER_CONFIG, denyExact: ['contact'] });
    });

    expect(webApiGet).toHaveBeenCalledTimes(2);
  });

  it('does not apply an older table result after a newer table request has started', async () => {
    const { service, results, listeners } = queuedTables();
    await render(
      <FormSelector entityName="" onEntityNameChange={vi.fn()} formXmlService={idleForms}
        metadataService={service} onFormSelected={vi.fn()} />
    );
    expect(results).toHaveLength(1);

    await act(async () => { listeners.forEach(listener => listener()); });
    expect(results).toHaveLength(2);

    await act(async () => { results[1].resolve({ status: 'ok', tables: [contactTable] }); });
    expect(await openCombo()).toContain('Contact');
    expect(await openCombo()).not.toContain('Account');

    await act(async () => { results[0].resolve({ status: 'ok', tables: [accountTable] }); });
    const options = await openCombo();
    expect(options).toContain('Contact');
    expect(options).not.toContain('Account');
  });

  it('drops a table result that resolves after unmount', async () => {
    const pending = deferred<TableListResult>();
    const { service, listeners } = tableService(() => pending.promise);
    await render(
      <FormSelector entityName="" onEntityNameChange={vi.fn()} formXmlService={idleForms}
        metadataService={service} onFormSelected={vi.fn()} />
    );
    expect(listeners.size).toBe(1);

    await act(async () => { root?.unmount(); });
    root = undefined;
    expect(listeners.size).toBe(0);

    await act(async () => { pending.resolve({ status: 'ok', tables: [accountTable] }); });
    expect(host?.textContent).not.toContain('Account');
  });

  it('unsubscribes the previous metadata service and subscribes the replacement', async () => {
    const first = tableService(() => Promise.resolve({ status: 'ok', tables: [accountTable] }));
    const second = tableService(() => Promise.resolve({ status: 'ok', tables: [contactTable] }));
    const element = (metadataService: typeof first.service) => (
      <FormSelector entityName="" onEntityNameChange={vi.fn()} formXmlService={idleForms}
        metadataService={metadataService} onFormSelected={vi.fn()} />
    );

    await render(element(first.service));
    await flush();
    expect(await openCombo()).toContain('Account');
    expect(first.listeners.size).toBe(1);

    await act(async () => { root?.render(element(second.service)); });
    await flush();

    expect(first.listeners.size).toBe(0);
    expect(second.listeners.size).toBe(1);
    const options = await openCombo();
    expect(options).toContain('Contact');
    expect(options).not.toContain('Account');
  });

  it('ignores the StrictMode throwaway table result and keeps one subscription', async () => {
    const { service, results, listeners } = queuedTables();
    await render(
      <React.StrictMode>
        <FormSelector entityName="" onEntityNameChange={vi.fn()} formXmlService={idleForms}
          metadataService={service} onFormSelected={vi.fn()} />
      </React.StrictMode>
    );

    expect(results).toHaveLength(2);
    expect(listeners.size).toBe(1);

    await act(async () => { results[0].resolve({ status: 'ok', tables: [accountTable] }); });
    expect(host?.querySelector<HTMLInputElement>('[role="combobox"]')?.disabled).toBe(true);

    await act(async () => { results[1].resolve({ status: 'ok', tables: [contactTable] }); });
    const activeOptions = await openCombo();
    expect(activeOptions).toContain('Contact');
    expect(activeOptions).not.toContain('Account');

    await act(async () => { listeners.forEach(listener => listener()); });
    expect(results).toHaveLength(3);

    await act(async () => { results[2].resolve({ status: 'ok', tables: [widgetTable] }); });
    const options = await openCombo();
    expect(options).toContain('Widget');
    expect(options).not.toContain('Contact');
    expect(listeners.size).toBe(1);
  });

  it('ignores an older form response after a newer entity is requested', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<FormLoadResult>>>();
    const forms = formXml(entity => {
      const next = deferred<FormLoadResult>();
      pending.set(entity, next);
      return next.promise;
    });
    const metadata = tableService(() => Promise.resolve({ status: 'ok', tables: [accountTable, contactTable] }));
    const onFormSelected = vi.fn();
    const element = (entityName: string) => (
      <FormSelector entityName={entityName} onEntityNameChange={vi.fn()} formXmlService={forms}
        metadataService={metadata.service} onFormSelected={onFormSelected} />
    );

    await render(element('account'));
    expect(onFormSelected).toHaveBeenCalledWith(null);
    await act(async () => { root?.render(element('contact')); });
    expect(pending.has('account')).toBe(true);
    expect(pending.has('contact')).toBe(true);

    await act(async () => {
      pending.get('contact')?.resolve({ ok: true, forms: [{ id: 'contact-form', name: 'Contact Main' }] });
    });
    const formSelect = () => host?.querySelector('select[aria-label="Form"]');
    expect(formSelect()?.textContent).toContain('Contact Main');
    expect(onFormSelected).toHaveBeenCalledWith({ entityLogicalName: 'contact', formId: 'contact-form' });

    await act(async () => {
      pending.get('account')?.resolve({ ok: true, forms: [{ id: 'account-form', name: 'Account Main' }] });
    });
    expect(formSelect()?.textContent).toContain('Contact Main');
    expect(formSelect()?.textContent).not.toContain('Account Main');
    expect(onFormSelected).not.toHaveBeenCalledWith({ entityLogicalName: 'account', formId: 'account-form' });
  });

  it('ignores a form response that resolves after unmount', async () => {
    const pending = deferred<FormLoadResult>();
    const forms = formXml(() => pending.promise);
    const onFormSelected = vi.fn();
    await render(
      <FormSelector entityName="account" onEntityNameChange={vi.fn()} formXmlService={forms}
        metadataService={mockMetadataService} onFormSelected={onFormSelected} />
    );
    expect(onFormSelected).toHaveBeenCalledTimes(1);
    expect(onFormSelected).toHaveBeenCalledWith(null);

    await act(async () => { root?.unmount(); });
    root = undefined;

    await act(async () => {
      pending.resolve({ ok: true, forms: [{ id: 'late-form', name: 'Late Main' }] });
    });
    expect(onFormSelected).toHaveBeenCalledTimes(1);
    expect(onFormSelected).not.toHaveBeenCalledWith({ entityLogicalName: 'account', formId: 'late-form' });
    expect(host?.textContent).not.toContain('Late Main');
  });

  it('retries a failed table list by invalidating the metadata service', async () => {
    const listAccessibleTables = vi.fn()
      .mockResolvedValueOnce({ status: 'error', reason: 'metadata unavailable' })
      .mockResolvedValueOnce({ status: 'ok', tables: [accountTable] });
    const service = {
      listAccessibleTables,
      invalidate: vi.fn(),
      subscribeTables: vi.fn(() => () => undefined),
    };
    await render(
      <FormSelector entityName="" onEntityNameChange={vi.fn()} formXmlService={idleForms}
        metadataService={service} onFormSelected={vi.fn()} />
    );
    await flush();

    await openCombo();
    expect(host?.textContent).toContain('metadata unavailable');
    const retry = Array.from(host?.querySelectorAll('button') ?? []).find(button => button.textContent === 'Retry');
    expect(retry).toBeTruthy();
    await act(async () => { retry?.click(); });
    await flush();

    expect(service.invalidate).toHaveBeenCalledTimes(1);
    expect(listAccessibleTables).toHaveBeenCalledTimes(2);
    const options = await openCombo();
    expect(options).toContain('Account');
    expect(options).not.toContain('metadata unavailable');
  });

  it('shares the preview-session custom-only filter and lists tables once per mounted consumer', async () => {
    const tables = [accountTable, eventTable];
    const listAccessibleTables = vi.fn().mockResolvedValue({ status: 'ok', tables });
    const service = {
      listAccessibleTables,
      invalidate: vi.fn(),
      subscribeTables: vi.fn(() => () => undefined),
    };
    const harness = (generation: number) => (
      <PreviewSessionProvider>
        <FormSelector entityName="" onEntityNameChange={vi.fn()} formXmlService={idleForms}
          metadataService={service} onFormSelected={vi.fn()} />
        <FormSelector key={generation} entityName="" onEntityNameChange={vi.fn()} formXmlService={idleForms}
          metadataService={service} onFormSelected={vi.fn()} />
      </PreviewSessionProvider>
    );

    await render(harness(0));
    await flush();
    expect(listAccessibleTables).toHaveBeenCalledTimes(2);
    expect(customOnlyButtons().map(button => button.getAttribute('aria-pressed'))).toEqual(['false', 'false']);

    await act(async () => { customOnlyButtons()[0].click(); });
    expect(customOnlyButtons()[0].getAttribute('aria-pressed')).toBe('true');
    const filtered = await openCombo(0);
    expect(filtered).toContain('Event');
    expect(filtered).not.toMatch(/account/i);

    await act(async () => { root?.render(harness(1)); });
    await flush();
    expect(listAccessibleTables).toHaveBeenCalledTimes(3);
    expect(customOnlyButtons().map(button => button.getAttribute('aria-pressed'))).toEqual(['true', 'true']);
    const adopted = await openCombo(1);
    expect(adopted).toContain('Event');
    expect(adopted).not.toMatch(/account/i);
  });
});
