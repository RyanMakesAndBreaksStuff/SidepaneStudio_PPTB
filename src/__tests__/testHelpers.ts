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

export function cfg(overrides: SectionOverrides & { target?: TargetConfig } = {}): PaneDefinitionConfig {
  return {
    pane:     { ...DEFAULT_CONFIG.pane,     ...(overrides.pane     ?? {}) },
    target:   overrides.target ?? DEFAULT_CONFIG.target,
    trigger:  { ...DEFAULT_CONFIG.trigger,  ...(overrides.trigger  ?? {}) },
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
