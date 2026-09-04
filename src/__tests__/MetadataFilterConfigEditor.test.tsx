import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetadataFilterConfigEditor } from '../components/config/MetadataFilterConfigEditor';
import { ThemeProvider } from '../contexts/ThemeContext';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

const customConfig = {
  denyPrefixes: ['msdyn_'],
  denyExact: ['webresource'],
  allowedStandardTables: ['account'],
};

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(<ThemeProvider>{element}</ThemeProvider>);
  });
}

function textarea(label: string): HTMLTextAreaElement {
  return Array.from(host?.querySelectorAll('textarea') ?? []).find(
    el => el.getAttribute('aria-label') === label
  ) as HTMLTextAreaElement;
}

async function setTextareaValue(element: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
  await act(async () => {
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(host?.querySelectorAll('button') ?? []).find(
    b => b.textContent?.includes(label)
  ) as HTMLButtonElement | undefined;
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

describe('MetadataFilterConfigEditor', () => {
  it('renders helper text for each filter type', async () => {
    await render(
      <MetadataFilterConfigEditor
        config={customConfig}
        defaultConfig={DEFAULT_METADATA_FILTER_CONFIG}
        persistenceAvailable={true}
        onSave={() => {}}
        onReset={() => {}}
      />
    );

    expect(host?.textContent).toContain('JSON array of table-name prefixes');
    expect(host?.textContent).toContain('JSON array of exact logical table names');
    expect(host?.textContent).toContain('JSON array of standard table names');
  });

  it('hides save until content is dirty and saves normalized arrays', async () => {
    const onSave = vi.fn();
    await render(
      <MetadataFilterConfigEditor
        config={customConfig}
        defaultConfig={DEFAULT_METADATA_FILTER_CONFIG}
        persistenceAvailable={true}
        onSave={onSave}
        onReset={() => {}}
      />
    );

    expect(button('Save')).toBeUndefined();

    await setTextareaValue(textarea('Allowed standard tables'), '[" contact ", "contact", "account"]');
    await act(async () => {
      button('Save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith({
      denyPrefixes: ['msdyn_'],
      denyExact: ['webresource'],
      allowedStandardTables: ['contact', 'account'],
    });
  });

  it('rejects invalid JSON array content', async () => {
    const onSave = vi.fn();
    await render(
      <MetadataFilterConfigEditor
        config={customConfig}
        defaultConfig={DEFAULT_METADATA_FILTER_CONFIG}
        persistenceAvailable={true}
        onSave={onSave}
        onReset={() => {}}
      />
    );

    await setTextareaValue(textarea('Deny exact table names'), '{"bad":true}');
    await act(async () => {
      button('Save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(host?.textContent).toContain('Enter a valid JSON array of strings');
  });

  it('leaves the busy state and does not throw unhandled when save rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
    await render(
      <MetadataFilterConfigEditor
        config={customConfig}
        defaultConfig={DEFAULT_METADATA_FILTER_CONFIG}
        persistenceAvailable={true}
        onSave={onSave}
        onReset={() => {}}
      />
    );

    await setTextareaValue(textarea('Allowed standard tables'), '["contact"]');
    await act(async () => {
      button('Save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    // The busy label must clear even though the save rejected.
    expect(button('Save')?.textContent).toBe('Save');
    expect(button('Save')?.disabled).toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('leaves the busy state and does not throw unhandled when reset rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = vi.fn().mockRejectedValue(new Error('reset failed'));
    await render(
      <MetadataFilterConfigEditor
        config={customConfig}
        defaultConfig={DEFAULT_METADATA_FILTER_CONFIG}
        persistenceAvailable={true}
        onSave={() => {}}
        onReset={onReset}
      />
    );

    await act(async () => {
      button('Reset to defaults')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(button('Reset to defaults')?.textContent).toBe('Reset to defaults');
    expect(button('Reset to defaults')?.disabled).toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('disables dirty save when persistence is unavailable but allows reset', async () => {
    const onReset = vi.fn();
    await render(
      <MetadataFilterConfigEditor
        config={customConfig}
        defaultConfig={DEFAULT_METADATA_FILTER_CONFIG}
        persistenceAvailable={false}
        onSave={() => {}}
        onReset={onReset}
      />
    );

    await setTextareaValue(textarea('Deny prefixes'), '["abc_"]');
    expect(host?.textContent).toContain('Save is disabled');
    expect(button('Save')?.disabled).toBe(true);

    await act(async () => {
      button('Reset to defaults')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(onReset).toHaveBeenCalled();
    expect(textarea('Deny prefixes').value).toBe(
      JSON.stringify(DEFAULT_METADATA_FILTER_CONFIG.denyPrefixes, null, 2)
    );
  });
});
