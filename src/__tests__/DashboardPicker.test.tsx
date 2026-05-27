import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardPicker } from '../components/DashboardPicker';
import type { DashboardInfo, AccessibleDashboardsResult } from '../services/MetadataService';
import { deferred } from './testHelpers';

function makeService(result: Promise<AccessibleDashboardsResult>) {
  return {
    listAccessibleDashboards: vi.fn(() => result),
    invalidate: vi.fn(),
  };
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  await act(async () => {
    root = createRoot(host!);
    root.render(element);
  });
}

afterEach(() => {
  if (root && host) {
    act(() => { root!.unmount(); });
    host.remove();
  }
  root = undefined;
  host = undefined;
});

describe('DashboardPicker', () => {
  it('shows disabled loading option while dashboards load', async () => {
    const pending = deferred<AccessibleDashboardsResult>();
    const service = makeService(pending.promise);
    await render(<DashboardPicker value="" onChange={() => {}} metadataService={service} />);
    const select = host?.querySelector('select');
    expect(select?.disabled).toBe(true);
    expect(select?.textContent).toContain('Loading');
  });

  it('renders loaded dashboards as select options', async () => {
    const dashboards: DashboardInfo[] = [
      { id: 'aaa', name: 'Sales Dashboard', isPersonal: false },
      { id: 'bbb', name: 'My Dashboard', isPersonal: true },
    ];
    const service = makeService(Promise.resolve({ status: 'ok', dashboards }));
    await render(<DashboardPicker value="" onChange={() => {}} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });
    const select = host?.querySelector('select') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(select.textContent).toContain('Sales Dashboard');
    expect(select.textContent).toContain('My Dashboard (Personal)');
  });

  it('calls onChange with id and name when selection changes', async () => {
    const onChange = vi.fn();
    const dashboards: DashboardInfo[] = [
      { id: 'aaa', name: 'Sales Dashboard', isPersonal: false },
    ];
    const service = makeService(Promise.resolve({ status: 'ok', dashboards }));
    await render(<DashboardPicker value="" onChange={onChange} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });
    const select = host?.querySelector('select') as HTMLSelectElement;
    select.value = 'aaa';
    await act(async () => {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('aaa', 'Sales Dashboard');
  });

  it('shows error state and retry button on failure', async () => {
    const service = makeService(Promise.resolve({ status: 'error', reason: 'Network error' }));
    await render(<DashboardPicker value="" onChange={() => {}} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });
    expect(host?.textContent).toContain('Could not load');
    const retryBtn = host?.querySelector('button');
    expect(retryBtn).toBeTruthy();
  });

  it('retries after clicking retry button', async () => {
    const service = {
      listAccessibleDashboards: vi.fn()
        .mockResolvedValueOnce({ status: 'error', reason: 'fail' })
        .mockResolvedValueOnce({ status: 'ok', dashboards: [{ id: 'aaa', name: 'Sales Dashboard', isPersonal: false }] }),
      invalidate: vi.fn(),
    };
    await render(<DashboardPicker value="" onChange={() => {}} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      host?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => { await Promise.resolve(); });
    expect(service.invalidate).toHaveBeenCalledTimes(1);
    expect(host?.textContent).toContain('Sales Dashboard');
  });
});
