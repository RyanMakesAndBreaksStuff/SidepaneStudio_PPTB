import { act } from 'react';
import { vi } from 'vitest';
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import { DEFAULT_CONFIG, PaneDefinitionConfig, TargetConfig } from '../types/PaneDefinitionConfig';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

/** Select an authored combobox option by its visible label. */
export async function chooseOption(host: HTMLElement, ariaLabel: string, text: string): Promise<void> {
  const input = host.querySelector<HTMLInputElement>(`[role="combobox"][aria-label="${ariaLabel}"]`);
  if (!input) throw new Error(`Combobox ${ariaLabel} was not found`);
  await act(async () => { input.focus(); });
  const option = Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'))
    .find(item => item.textContent?.includes(text));
  if (!option) throw new Error(`Option ${text} was not found in ${ariaLabel}`);
  await act(async () => { option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
}

type SectionOverrides = {
  [K in Exclude<keyof PaneDefinitionConfig, 'target'>]?: Partial<PaneDefinitionConfig[K]>;
};

// WR-010: DEFAULT_CONFIG ships blank names, so tests that are not about them supply explicit values.
export const TEST_TARGET_NAME = 'sps_SidePaneBuilderPage';
export const TEST_NAMESPACE = 'YourNamespace';

export function cfg(overrides: SectionOverrides & { target?: TargetConfig } = {}): PaneDefinitionConfig {
  return {
    pane:     { ...DEFAULT_CONFIG.pane,     ...(overrides.pane     ?? {}) },
    target:   overrides.target ?? { pageType: 'custom', name: TEST_TARGET_NAME },
    trigger:  { ...DEFAULT_CONFIG.trigger,  namespace: TEST_NAMESPACE, ...(overrides.trigger  ?? {}) },
    host:     { ...DEFAULT_CONFIG.host,     ...(overrides.host     ?? {}) },
    context:  { ...DEFAULT_CONFIG.context,  ...(overrides.context  ?? {}) },
    behavior: { ...DEFAULT_CONFIG.behavior, ...(overrides.behavior ?? {}) },
  };
}

export function xrmStub(): IXrmContext {
  return {
    checkWebResourceExists: vi.fn().mockResolvedValue(true),
    webApiGet: vi.fn(),
    webApiGetEntity: vi.fn(),
    fetchXml: vi.fn(),
  };
}
