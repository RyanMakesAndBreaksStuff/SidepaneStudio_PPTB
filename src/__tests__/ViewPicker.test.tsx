import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ViewPicker } from '../components/ViewPicker';
import { ThemeProvider } from '../contexts/ThemeContext';
import type { ViewsForEntityResult } from '../services/MetadataService';
import { chooseOption } from './testHelpers';

it('ignores stale views and emits the complete personal view only after selection', async () => {
  let finishOld!: (result: ViewsForEntityResult) => void;
  const view = { id: '11111111-2222-3333-4444-555555555555', name: 'My contacts', viewType: 'userquery' as const, fetchXml: '<fetch />', layoutXml: '' };
  const metadataService = { listViewsForEntity: vi.fn()
    .mockImplementationOnce(() => new Promise<ViewsForEntityResult>(resolve => { finishOld = resolve; }))
    .mockResolvedValue({ status: 'ok', views: [view] }) };
  const onChange = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = (entityName: string) => {
    const element: React.ReactElement = <ThemeProvider><ViewPicker entityName={entityName} value="" viewType="" onChange={onChange} metadataService={metadataService} /></ThemeProvider>;
    root.render(element);
  };
  try {
    await act(async () => render('account'));
    await act(async () => render('contact'));
    await act(async () => finishOld({ status: 'ok', views: [{ ...view, name: 'Stale accounts' }] }));
    expect(host.textContent).not.toContain('Stale accounts');
    expect(onChange).not.toHaveBeenCalled();
    await chooseOption(host, 'View', 'My contacts');
    expect(onChange).toHaveBeenCalledWith(view);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('reports current selected-view loading, resolution, error, and unavailable states', async () => {
  const view = { id: '11111111-2222-3333-4444-555555555555', name: 'Accounts', viewType: 'savedquery' as const, fetchXml: '<fetch />', layoutXml: '' };
  const statuses: string[] = [];
  const onStatusChange = (status: string) => statuses.push(status);
  const onChange = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = (metadataService: { listViewsForEntity: () => Promise<ViewsForEntityResult> }) => {
    root.render(<ThemeProvider><ViewPicker entityName="account" value={view.id} viewType="savedquery"
      onChange={onChange} onStatusChange={onStatusChange} metadataService={metadataService} /></ThemeProvider>);
  };
  try {
    const available = { listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [view] }) };
    await act(async () => { render(available); await Promise.resolve(); });
    expect(statuses).toContain('resolved');

    const failed = { listViewsForEntity: vi.fn().mockRejectedValue(new Error('View metadata unavailable')) };
    await act(async () => { render(failed); await Promise.resolve(); });
    expect(statuses).toContain('loading');
    expect(statuses).toContain('error');

    const unavailable = { listViewsForEntity: vi.fn().mockResolvedValue({ status: 'ok', views: [] }) };
    await act(async () => { render(unavailable); await Promise.resolve(); });
    expect(statuses).toContain('unavailable');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
