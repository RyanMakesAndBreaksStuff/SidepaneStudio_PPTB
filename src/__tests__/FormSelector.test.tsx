import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormSelector } from '../components/FormSelector';
import { FormXmlService } from '../services/FormXmlService';
import { MetadataService } from '../services/MetadataService';

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

const mockMetadataService = {
  listAccessibleTables: vi.fn().mockResolvedValue({ status: 'ok', tables: [] }),
  invalidate: vi.fn(),
} as unknown as MetadataService;

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
});
