/* import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewPanel } from '../components/PreviewPanel';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function formXml(label: string) {
  return `
<form>
  <tabs>
    <tab name="tab_${label}" expanded="true">
      <labels><label description="${label}" languagecode="1033"/></labels>
      <columns><column><sections><section name="sec_${label}" columns="1">
        <labels><label description="${label} Section"/></labels>
        <rows><row><cell><labels><label description="${label} Field"/></labels><control datafieldname="name" classid="{4273EDBD-AC1D-4784-AC51-54A6FBFF39F7}"/></cell></row></rows>
      </section></sections></column></columns>
    </tab>
  </tabs>
</form>`.trim();
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
  vi.unstubAllGlobals();
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('PreviewPanel', () => {
  it('renders mock preview in a native Power Apps Side Pane Studio shell', async () => {
    await render(<PreviewPanel config={DEFAULT_CONFIG} validation={{ isValid: true, errors: [], warnings: [] }} />);

    expect(host?.textContent).toContain('Power Apps');
    expect(host?.textContent).toContain('Side Pane Studio');
    expect(host?.textContent).toContain('Summary');
    expect(host?.textContent).toContain('Timeline');
    expect(host?.textContent).not.toContain('Dynamics 365');
    expect(host?.textContent).not.toContain('Code Generator');
  });

  it('renders loaded form preview inside the same native Side Pane Studio shell', async () => {
    const formId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

    vi.stubGlobal('dataverseAPI', {
      queryData: vi.fn((path: string) => {
        if (path.includes('$filter=objecttypecode')) {
          return Promise.resolve({
            value: [
              { formid: formId, name: 'Main Account Form' },
            ],
          });
        }
        if (path === `systemforms(${formId})?$select=formxml`) {
          return Promise.resolve({ formxml: formXml('Native') });
        }
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      }),
    });

    const config = {
      ...DEFAULT_CONFIG,
      target: { ...DEFAULT_CONFIG.target, entityName: 'account' },
    };

    await render(<PreviewPanel config={config} validation={{ isValid: true, errors: [], warnings: [] }} />);

    await act(async () => {
      Array.from(host?.querySelectorAll('button') ?? [])
        .find(button => button.textContent === 'Form')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const select = host?.querySelector('select') as HTMLSelectElement;
    select.value = formId;
    await act(async () => {
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(host?.textContent).toContain('Power Apps');
    expect(host?.textContent).toContain('Side Pane Studio');
    expect(host?.textContent).toContain('Native Field');
    expect(host?.textContent).not.toContain('Code Generator');
  });

  it('ignores stale form model responses after a newer form selection', async () => {
    const first = deferred<{ formxml: string }>();
    const second = deferred<{ formxml: string }>();
    const firstId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const secondId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

    vi.stubGlobal('dataverseAPI', {
      queryData: vi.fn((path: string) => {
        if (path.includes('$filter=objecttypecode')) {
          return Promise.resolve({
            value: [
              { formid: firstId, name: 'First Form' },
              { formid: secondId, name: 'Second Form' },
            ],
          });
        }
        if (path === `systemforms(${firstId})?$select=formxml`) return first.promise;
        if (path === `systemforms(${secondId})?$select=formxml`) return second.promise;
        return Promise.reject(new Error(`Unexpected path: ${path}`));
      }),
    });

    const config = {
      ...DEFAULT_CONFIG,
      target: { ...DEFAULT_CONFIG.target, entityName: 'account' },
    };

    await render(<PreviewPanel config={config} validation={{ isValid: true, errors: [], warnings: [] }} />);

    await act(async () => {
      Array.from(host?.querySelectorAll('button') ?? [])
        .find(button => button.textContent === 'Form')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const select = host?.querySelector('select') as HTMLSelectElement;
    select.value = firstId;
    await act(async () => {
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    select.value = secondId;
    await act(async () => {
      select.dispatchEvent(new Event('change', { bubbles: true }));
      second.resolve({ formxml: formXml('Second') });
      await Promise.resolve();
    });

    expect(host?.textContent).toContain('Second Field');

    await act(async () => {
      first.resolve({ formxml: formXml('First') });
      await Promise.resolve();
    });

    expect(host?.textContent).toContain('Second Field');
    expect(host?.textContent).not.toContain('First Field');
  });
});
 */