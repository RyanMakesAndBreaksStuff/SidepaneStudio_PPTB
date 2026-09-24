import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from '../components/CodeBlock';
import { CommandStepsTab } from '../components/CommandStepsTab';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';

let root: Root;
let host: HTMLDivElement;
let errors: ErrorEvent[];
const captureError = (event: ErrorEvent) => {
  errors.push(event);
  event.preventDefault();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('toolboxAPI', undefined);
  vi.stubGlobal('navigator', { clipboard: undefined });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  errors = [];
  window.addEventListener('error', captureError);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  window.removeEventListener('error', captureError);
  host.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each(['code', 'function'] as const)('%s clipboard', kind => {
  const text = kind === 'code' ? 'const value = "exact text";' : 'Review.openPane';

  async function mount() {
    await act(async () => {
      root.render(kind === 'code' ? <CodeBlock code={text} /> :
        <CommandStepsTab config={{
          ...DEFAULT_CONFIG,
          trigger: {
            ...DEFAULT_CONFIG.trigger,
            kind: 'FormOnLoad',
            namespace: 'Review',
            functionName: 'openPane',
          },
        }} />);
    });
  }

  async function copy() {
    const button = Array.from(host.querySelectorAll('button'))
      .find(item => item.textContent?.includes('Copy'));
    expect(button).toBeDefined();
    await act(async () => { button!.click(); });
  }

  function expectManualFallback() {
    expect(errors).toEqual([]);
    expect(host.textContent).toContain('Clipboard access blocked');
    expect(host.querySelector('textarea')?.value).toBe(text);
    expect(host.textContent).not.toContain('Copied!');
  }

  it('prefers PPTB when both clipboard APIs exist', async () => {
    const copyToClipboard = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { utils: { copyToClipboard } });
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await mount();
    await copy();
    expect(copyToClipboard).toHaveBeenCalledWith(text);
    expect(writeText).not.toHaveBeenCalled();
    expect(host.querySelector('textarea')).toBeNull();
    expect(errors).toEqual([]);
    if (kind === 'code') expect(host.textContent).toContain('Copied!');
  });

  it('uses browser clipboard when the host method is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { utils: {} });
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await mount();
    await copy();
    expect(writeText).toHaveBeenCalledWith(text);
    expect(host.querySelector('textarea')).toBeNull();
    expect(errors).toEqual([]);
  });

  it('shows manual selection when neither API exists', async () => {
    await mount();
    await copy();
    expectManualFallback();
  });

  it.each(['host rejection', 'host throw', 'browser rejection', 'browser throw'] as const)(
    'shows manual selection after %s', async failure => {
      const operation = failure.endsWith('throw')
        ? vi.fn(() => { throw new Error('clipboard unavailable'); })
        : vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
      const browserSuccess = vi.fn().mockResolvedValue(undefined);
      if (failure.startsWith('host')) {
        vi.stubGlobal('toolboxAPI', { utils: { copyToClipboard: operation } });
        vi.stubGlobal('navigator', { clipboard: { writeText: browserSuccess } });
      } else {
        vi.stubGlobal('navigator', { clipboard: { writeText: operation } });
      }
      await mount();
      await copy();
      expect(operation).toHaveBeenCalledWith(text);
      expect(browserSuccess).not.toHaveBeenCalled();
      expectManualFallback();
    },
  );

  it('clears manual fallback after a successful host retry without browser support', async () => {
    const copyToClipboard = vi.fn()
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { utils: { copyToClipboard } });
    await mount();
    await copy();
    expectManualFallback();
    await copy();
    expect(copyToClipboard).toHaveBeenCalledTimes(2);
    expect(host.querySelector('textarea')).toBeNull();
    expect(errors).toEqual([]);
    if (kind === 'code') expect(host.textContent).toContain('Copied!');
  });
});
