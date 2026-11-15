import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardPicker } from '../components/DashboardPicker';
import type { DashboardInfo, AccessibleDashboardsResult } from '../services/MetadataService';
import { chooseOption, deferred } from './testHelpers';

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

function dashboardInput(): HTMLInputElement {
  const input = host?.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Dashboard"]');
  if (!input) throw new Error('Dashboard combobox not rendered');
  return input;
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
  it('shows a disabled combobox while dashboards load', async () => {
    const pending = deferred<AccessibleDashboardsResult>();
    const service = makeService(pending.promise);
    await render(<DashboardPicker value="" onChange={() => {}} metadataService={service} />);
    const input = host?.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Dashboard"]');
    expect(input?.disabled).toBe(true);
  });

  it('renders loaded dashboards as combobox options', async () => {
    const dashboards: DashboardInfo[] = [
      { id: 'aaa', name: 'Sales Dashboard', isPersonal: false },
      { id: 'bbb', name: 'My Dashboard', isPersonal: true },
    ];
    const service = makeService(Promise.resolve({ status: 'ok', dashboards }));
    await render(<DashboardPicker value="" onChange={() => {}} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });
    const input = dashboardInput();
    expect(input.disabled).toBe(false);
    await act(async () => { input.focus(); });
    expect(host?.textContent).toContain('Sales Dashboard');
    expect(host?.textContent).toContain('My Dashboard');
    expect(host?.textContent).toContain('Personal');
  });

  it('keeps an unset value unselected and commits the first dashboard when chosen', async () => {
    const onChange = vi.fn();
    const dashboards: DashboardInfo[] = [
      { id: 'aaa', name: 'Only Dashboard', isPersonal: false },
    ];
    const service = makeService(Promise.resolve({ status: 'ok', dashboards }));
    await render(<DashboardPicker value="" onChange={onChange} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });
    const input = dashboardInput();
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('Select a dashboard…');
    expect(onChange).not.toHaveBeenCalled();
    await chooseOption(host!, 'Dashboard', 'Only Dashboard');
    expect(onChange).toHaveBeenCalledWith('aaa', 'Only Dashboard');
  });

  it('shows the selected dashboard without a placeholder', async () => {
    const dashboards: DashboardInfo[] = [{ id: 'aaa', name: 'Sales Dashboard', isPersonal: false }];
    const service = makeService(Promise.resolve({ status: 'ok', dashboards }));
    await render(<DashboardPicker value="aaa" onChange={() => {}} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });
    const input = dashboardInput();
    expect(input.value).toContain('Sales Dashboard');
    expect(input.placeholder).toBe('');
  });

  it('clears the selection when Clear selection is clicked', async () => {
    const onChange = vi.fn();
    const dashboards: DashboardInfo[] = [{ id: 'aaa', name: 'Sales Dashboard', isPersonal: false }];
    const service = makeService(Promise.resolve({ status: 'ok', dashboards }));
    await render(<DashboardPicker value="aaa" onChange={onChange} metadataService={service} />);
    await act(async () => { await Promise.resolve(); });
    const clear = host?.querySelector<HTMLButtonElement>('button[aria-label="Clear selection"]');
    expect(clear).toBeTruthy();
    await act(async () => {
      clear!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('', '');
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
    const input = dashboardInput();
    await act(async () => { input.focus(); });
    expect(host?.textContent).toContain('Sales Dashboard');
  });
});
