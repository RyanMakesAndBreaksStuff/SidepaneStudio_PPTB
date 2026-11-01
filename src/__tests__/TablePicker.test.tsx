import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TablePicker } from '../components/TablePicker';
import { MetadataService, TableInfo } from '../services/MetadataService';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';
import { deferred } from './testHelpers';

type TableListResult =
  | { status: 'ok'; tables: TableInfo[] }
  | { status: 'error'; reason: string };

const accountTable: TableInfo = { logicalName: 'account', displayName: 'Account', objectTypeCode: 1, isCustomEntity: false };
const contactTable: TableInfo = { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2, isCustomEntity: false };
const widgetTable: TableInfo = { logicalName: 'new_widget', displayName: 'Widget', objectTypeCode: 100, isCustomEntity: true };

function makeService(result: Promise<TableListResult>) {
  return {
    listAccessibleTables: vi.fn(() => result),
    invalidate: vi.fn(),
    subscribeTables: vi.fn(() => () => undefined),
  };
}

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

function lastNotified(callback: { mock: { calls: unknown[][] } }) {
  const calls = callback.mock.calls;
  return calls[calls.length - 1]?.[0];
}

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

function combo(): HTMLInputElement {
  return host?.querySelector('[role="combobox"]') as HTMLInputElement;
}

function options(): HTMLElement[] {
  return Array.from(host?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
}

async function openPicker() {
  await act(async () => { combo().focus(); combo().click(); });
}

async function choose(logicalName: string) {
  await openPicker();
  const option = options().find(item => item.textContent?.includes(logicalName));
  expect(option, logicalName).toBeTruthy();
  await act(async () => { option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
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

describe('TablePicker', () => {
  it('shows a disabled loading picker while tables load', async () => {
    const pending = deferred<{ status: 'ok'; tables: TableInfo[] }>();
    const service = makeService(pending.promise);

    await render(<TablePicker value="" onChange={() => { /* noop */ }} metadataService={service} />);

    expect(combo().disabled).toBe(true);
    expect(combo().placeholder).toBe('Loading tables...');
  });

  it('renders loaded table options and emits logical name changes', async () => {
    const onChange = vi.fn();
    const service = makeService(Promise.resolve({
      status: 'ok',
      tables: [
        { logicalName: 'account', displayName: 'Account', objectTypeCode: 1 },
        { logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 },
      ],
    }));

    await render(<TablePicker value="account" onChange={onChange} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });

    const input = combo();
    expect(input.disabled).toBe(false);
    expect(input.value).toBe('Account (account)');
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Accountaccount');
    expect(options().map(option => option.textContent).join(' ')).toContain('Contactcontact');
    await choose('contact');

    expect(onChange).toHaveBeenCalledWith('contact');
  });

  it('shows an error state and retries after invalidating the service', async () => {
    const service = {
      listAccessibleTables: vi.fn()
        .mockResolvedValueOnce({ status: 'error', reason: 'metadata unavailable' })
        .mockResolvedValueOnce({
          status: 'ok',
          tables: [{ logicalName: 'account', displayName: 'Account', objectTypeCode: 1 }],
        }),
      invalidate: vi.fn(),
      subscribeTables: vi.fn(() => () => undefined),
    };

    await render(<TablePicker value="" onChange={() => { /* noop */ }} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });

    expect(combo().disabled).toBe(true);
    expect(host?.textContent).toContain('Could not load table list');

    await act(async () => {
      Array.from(host?.querySelectorAll('button') ?? [])
        .find(button => button.textContent === 'Retry')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(service.invalidate).toHaveBeenCalledTimes(1);
    expect(service.listAccessibleTables).toHaveBeenCalledTimes(2);
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Accountaccount');
  });

  it('keeps a saved inaccessible table visible', async () => {
    const service = makeService(Promise.resolve({
      status: 'ok',
      tables: [{ logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 }],
    }));

    await render(<TablePicker value="account" onChange={() => { /* noop */ }} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });

    expect(combo().value).toBe('account');
    expect(host?.textContent).toContain('Saved table “account” is no longer accessible.');
    await openPicker();
    expect(options().some(option => option.textContent?.includes('account'))).toBe(false);
  });

  it('reloads mounted options when the filter configuration changes', async () => {
    const metadata = new MetadataService({ webApiGet: vi.fn().mockResolvedValue(
      ['account', 'contact'].map(name => ({ LogicalName: name, SchemaName: name, EntitySetName: `${name}s`, IsCustomEntity: true }))
    ) });
    await render(<TablePicker value="" onChange={() => { /* noop */ }} metadataService={metadata} />);
    await act(async () => { await Promise.resolve(); });
    await openPicker();
    expect(options().some(option => option.textContent?.includes('contact'))).toBe(true);

    await act(async () => {
      metadata.setFilterConfig({ ...DEFAULT_METADATA_FILTER_CONFIG, denyExact: ['contact'] });
    });
    await act(async () => { await Promise.resolve(); });

    await openPicker();
    expect(options().some(option => option.textContent?.includes('contact'))).toBe(false);
    expect(options().some(option => option.textContent?.includes('account'))).toBe(true);
  });

  it('reports undefined while tables are pending and every logical name after success, including tables hidden by the custom-only filter', async () => {
    const pending = deferred<TableListResult>();
    const service = makeService(pending.promise);
    const onAccessibleTablesChange = vi.fn();

    await render(
      <TablePicker
        value=""
        onChange={() => { /* noop */ }}
        metadataService={service}
        onAccessibleTablesChange={onAccessibleTablesChange}
        customOnlyState={[true, () => { /* noop */ }]}
      />
    );

    expect(combo().disabled).toBe(true);
    expect(combo().placeholder).toBe('Loading tables...');
    expect(onAccessibleTablesChange).toHaveBeenCalledTimes(1);
    expect(onAccessibleTablesChange).toHaveBeenCalledWith(undefined);

    await act(async () => {
      pending.resolve({ status: 'ok', tables: [accountTable, widgetTable] });
    });

    const filterButton = host?.querySelector<HTMLButtonElement>('[aria-label="Show custom tables only"]');
    expect(filterButton?.getAttribute('aria-pressed')).toBe('true');
    expect(combo().disabled).toBe(false);
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Widgetnew_widget');
    expect(options().map(option => option.textContent).join(' ')).not.toContain('Accountaccount');
    expect(lastNotified(onAccessibleTablesChange)).toEqual(new Set(['account', 'new_widget']));
  });

  it('reports undefined when the table list fails or the request rejects', async () => {
    const onAccessibleTablesChange = vi.fn();
    const failed = {
      listAccessibleTables: vi.fn().mockResolvedValue({ status: 'error', reason: 'metadata unavailable' }),
      invalidate: vi.fn(),
      subscribeTables: vi.fn(() => () => undefined),
    };

    await render(
      <TablePicker value="" onChange={() => { /* noop */ }} metadataService={failed} onAccessibleTablesChange={onAccessibleTablesChange} />
    );
    await act(async () => { await Promise.resolve(); });

    expect(host?.textContent).toContain('Could not load table list');
    expect(host?.textContent).toContain('metadata unavailable');
    expect(onAccessibleTablesChange).toHaveBeenCalledWith(undefined);
    expect(onAccessibleTablesChange).not.toHaveBeenCalledWith(expect.any(Set));

    onAccessibleTablesChange.mockClear();
    const rejected = {
      listAccessibleTables: vi.fn().mockRejectedValue(new Error('metadata exploded')),
      invalidate: vi.fn(),
      subscribeTables: vi.fn(() => () => undefined),
    };
    await act(async () => {
      root?.unmount();
      root = undefined;
      host?.remove();
    });
    await render(
      <TablePicker value="" onChange={() => { /* noop */ }} metadataService={rejected} onAccessibleTablesChange={onAccessibleTablesChange} />
    );
    await act(async () => { await Promise.resolve(); });

    expect(host?.textContent).toContain('metadata exploded');
    expect(host?.textContent).not.toContain('Unable to load table list.');
    expect(onAccessibleTablesChange).toHaveBeenCalledWith(undefined);
    expect(onAccessibleTablesChange).not.toHaveBeenCalledWith(expect.any(Set));
  });

  it('uses the fallback reason when table loading rejects with a non-Error', async () => {
    const onAccessibleTablesChange = vi.fn();
    const service = {
      listAccessibleTables: vi.fn().mockRejectedValue('offline'),
      invalidate: vi.fn(),
      subscribeTables: vi.fn(() => () => undefined),
    };

    await render(
      <TablePicker value="" onChange={() => { /* noop */ }} metadataService={service} onAccessibleTablesChange={onAccessibleTablesChange} />
    );
    await act(async () => { await Promise.resolve(); });

    expect(host?.textContent).toContain('Unable to load table list.');
    expect(host?.textContent).not.toContain('offline');
    expect(onAccessibleTablesChange).toHaveBeenCalledWith(undefined);
    expect(onAccessibleTablesChange).not.toHaveBeenCalledWith(expect.any(Set));
  });

  it('reloads when onAccessibleTablesChange changes and ignores the in-flight first result', async () => {
    const first = deferred<TableListResult>();
    const second = deferred<TableListResult>();
    const listAccessibleTables = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const service = {
      listAccessibleTables,
      invalidate: vi.fn(),
      subscribeTables: vi.fn(() => () => undefined),
    };
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const onChange = () => { /* noop */ };
    const element = (onAccessibleTablesChange: (tables: Set<string> | undefined) => void) => (
      <TablePicker value="" onChange={onChange} metadataService={service} onAccessibleTablesChange={onAccessibleTablesChange} />
    );

    await render(element(firstCallback));
    expect(listAccessibleTables).toHaveBeenCalledTimes(1);
    expect(firstCallback).toHaveBeenCalledWith(undefined);

    await act(async () => { root?.render(element(secondCallback)); });

    expect(listAccessibleTables).toHaveBeenCalledTimes(2);
    expect(combo().disabled).toBe(true);
    expect(combo().placeholder).toBe('Loading tables...');
    expect(secondCallback).toHaveBeenCalledWith(undefined);

    await act(async () => {
      second.resolve({ status: 'ok', tables: [contactTable] });
    });
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Contactcontact');
    expect(lastNotified(secondCallback)).toEqual(new Set(['contact']));

    await act(async () => {
      first.resolve({ status: 'ok', tables: [accountTable] });
    });
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Contactcontact');
    expect(options().map(option => option.textContent).join(' ')).not.toContain('Accountaccount');
    expect(firstCallback).not.toHaveBeenCalledWith(expect.any(Set));
    expect(lastNotified(secondCallback)).toEqual(new Set(['contact']));
    expect(secondCallback.mock.calls.filter(call => call[0] instanceof Set)).toEqual([[new Set(['contact'])]]);
  });

  it('does not apply an older table result after a newer request has started', async () => {
    const { service, results, listeners } = queuedTables();
    const onAccessibleTablesChange = vi.fn();

    await render(
      <TablePicker value="" onChange={() => { /* noop */ }} metadataService={service} onAccessibleTablesChange={onAccessibleTablesChange} />
    );
    expect(results).toHaveLength(1);
    expect(listeners.size).toBe(1);

    await act(async () => { listeners.forEach(listener => listener()); });
    expect(results).toHaveLength(2);
    expect(combo().placeholder).toBe('Loading tables...');
    expect(onAccessibleTablesChange).toHaveBeenLastCalledWith(undefined);

    await act(async () => {
      results[1].resolve({ status: 'ok', tables: [contactTable] });
    });
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Contactcontact');
    expect(lastNotified(onAccessibleTablesChange)).toEqual(new Set(['contact']));
    const callsAfterNewer = onAccessibleTablesChange.mock.calls.length;

    await act(async () => {
      results[0].resolve({ status: 'ok', tables: [accountTable] });
    });
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Contactcontact');
    expect(options().map(option => option.textContent).join(' ')).not.toContain('Accountaccount');
    expect(onAccessibleTablesChange).toHaveBeenCalledTimes(callsAfterNewer);
  });

  it('does not notify accessible tables when the request resolves after unmount', async () => {
    const pending = deferred<TableListResult>();
    const { service, listeners } = tableService(() => pending.promise);
    const onAccessibleTablesChange = vi.fn();

    await render(
      <TablePicker value="" onChange={() => { /* noop */ }} metadataService={service} onAccessibleTablesChange={onAccessibleTablesChange} />
    );
    expect(onAccessibleTablesChange).toHaveBeenCalledTimes(1);
    expect(onAccessibleTablesChange).toHaveBeenCalledWith(undefined);
    expect(listeners.size).toBe(1);

    await act(async () => { root?.unmount(); });
    root = undefined;
    expect(listeners.size).toBe(0);

    await act(async () => {
      pending.resolve({ status: 'ok', tables: [accountTable] });
    });
    expect(onAccessibleTablesChange).toHaveBeenCalledTimes(1);
    expect(onAccessibleTablesChange).not.toHaveBeenCalledWith(expect.any(Set));
    expect(host?.textContent).not.toContain('Account (account)');
  });

  it('unsubscribes the previous metadata service and subscribes the replacement', async () => {
    const first = tableService(() => Promise.resolve({ status: 'ok', tables: [accountTable] }));
    const second = tableService(() => Promise.resolve({ status: 'ok', tables: [contactTable] }));
    const onChange = () => { /* noop */ };

    await render(<TablePicker value="" onChange={onChange} metadataService={first.service} />);
    await act(async () => { await Promise.resolve(); });
    expect(combo().value).toBe('');
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Accountaccount');
    expect(first.listeners.size).toBe(1);

    await act(async () => {
      root?.render(<TablePicker value="" onChange={onChange} metadataService={second.service} />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(first.listeners.size).toBe(0);
    expect(second.listeners.size).toBe(1);
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Contactcontact');
    expect(options().map(option => option.textContent).join(' ')).not.toContain('Accountaccount');
  });

  it('ignores the StrictMode throwaway table result and keeps one subscription', async () => {
    const { service, results, listeners } = queuedTables();
    const onAccessibleTablesChange = vi.fn();

    await render(
      <React.StrictMode>
        <TablePicker value="" onChange={() => { /* noop */ }} metadataService={service} onAccessibleTablesChange={onAccessibleTablesChange} />
      </React.StrictMode>
    );

    expect(results).toHaveLength(2);
    expect(listeners.size).toBe(1);
    expect(onAccessibleTablesChange).not.toHaveBeenCalledWith(expect.any(Set));

    await act(async () => {
      results[0].resolve({ status: 'ok', tables: [accountTable] });
    });
    expect(host?.textContent).not.toContain('Account (account)');
    expect(onAccessibleTablesChange).not.toHaveBeenCalledWith(expect.any(Set));

    await act(async () => {
      results[1].resolve({ status: 'ok', tables: [contactTable] });
    });
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Contactcontact');
    expect(lastNotified(onAccessibleTablesChange)).toEqual(new Set(['contact']));

    await act(async () => { listeners.forEach(listener => listener()); });
    expect(results).toHaveLength(3);
    expect(combo().placeholder).toBe('Loading tables...');

    await act(async () => {
      results[2].resolve({ status: 'ok', tables: [widgetTable] });
    });
    await openPicker();
    expect(options().map(option => option.textContent).join(' ')).toContain('Widgetnew_widget');
    expect(options().map(option => option.textContent).join(' ')).not.toContain('Contactcontact');
    expect(listeners.size).toBe(1);
    expect(lastNotified(onAccessibleTablesChange)).toEqual(new Set(['new_widget']));
  });
});
