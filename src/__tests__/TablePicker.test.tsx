import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TablePicker } from '../components/TablePicker';
import { TableInfo } from '../services/MetadataService';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function makeService(result: Promise<{ status: 'ok'; tables: TableInfo[] } | { status: 'error'; reason: string }>) {
  return {
    listAccessibleTables: vi.fn(() => result),
    invalidate: vi.fn(),
  };
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
  it('shows a disabled loading select while tables load', async () => {
    const pending = deferred<{ status: 'ok'; tables: TableInfo[] }>();
    const service = makeService(pending.promise);

    await render(<TablePicker value="" onChange={() => { /* noop */ }} metadataService={service} />);

    const select = host?.querySelector('select');
    expect(select?.disabled).toBe(true);
    expect(select?.textContent).toContain('Loading tables...');
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

    const select = host?.querySelector('select') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(select.textContent).toContain('Account (account)');
    expect(select.textContent).toContain('Contact (contact)');

    select.value = 'contact';
    await act(async () => {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('contact');
  });

  it('shows an error state and retries after invalidating the service', async () => {
    const service = makeService(Promise.resolve({ status: 'error', reason: 'metadata unavailable' }));

    await render(<TablePicker value="" onChange={() => { /* noop */ }} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });

    expect(host?.querySelector('select')?.disabled).toBe(true);
    expect(host?.textContent).toContain('Could not load table list');

    await act(async () => {
      host?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(service.invalidate).toHaveBeenCalledTimes(1);
    expect(service.listAccessibleTables).toHaveBeenCalledTimes(2);
  });

  it('keeps a saved inaccessible table visible', async () => {
    const service = makeService(Promise.resolve({
      status: 'ok',
      tables: [{ logicalName: 'contact', displayName: 'Contact', objectTypeCode: 2 }],
    }));

    await render(<TablePicker value="account" onChange={() => { /* noop */ }} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });

    const select = host?.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('account');
    expect(select.textContent).toContain('account (no longer accessible)');
  });
});
