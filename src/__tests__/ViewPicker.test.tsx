import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ViewPicker } from '../components/ViewPicker';
import { ThemeProvider } from '../contexts/ThemeContext';
import type { ViewsForEntityResult } from '../services/MetadataService';

it('ignores stale views and emits the complete personal view only after selection', async () => {
  let finishOld!: (result: ViewsForEntityResult) => void;
  const view = { id: '11111111-2222-3333-4444-555555555555', name: 'My contacts', viewType: 'userquery' as const, fetchXml: '<fetch />' };
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
    const select = host.querySelector('select')!;
    await act(async () => {
      select.value = `userquery:${view.id}`;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(view);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});