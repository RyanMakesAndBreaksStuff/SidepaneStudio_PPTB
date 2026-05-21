import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormSelector } from '../components/FormSelector';
import { FormXmlService } from '../services/FormXmlService';

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

describe('FormSelector', () => {
  it('shows load failure and retries to recovered form data', async () => {
    const getFormsForEntityResult = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'query-failed', message: 'offline' } })
      .mockResolvedValueOnce({ ok: true, forms: [{ id: 'form-1', name: 'Main Form' }] });
    const formXmlService = {
      getFormsForEntityResult,
    } as unknown as FormXmlService;
    const onFormSelected = vi.fn();

    await render(
      <FormSelector entityName="account" formXmlService={formXmlService} onFormSelected={onFormSelected} />
    );
    await act(async () => { await Promise.resolve(); });

    expect(host?.textContent).toContain('Could not load main forms');
    expect(host?.querySelector('button')?.textContent).toContain('Retry');

    await act(async () => {
      host?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(getFormsForEntityResult).toHaveBeenCalledTimes(2);
    expect(host?.textContent).toContain('Main Form');
    expect(host?.textContent).not.toContain('Could not load main forms');
  });
});
