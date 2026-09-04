import { vi } from 'vitest';
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import { DEFAULT_CONFIG, PaneDefinitionConfig, TargetConfig } from '../types/PaneDefinitionConfig';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

export function cfg(
  overrides: Partial<Omit<PaneDefinitionConfig, 'target'>> & { target?: TargetConfig } = {}
): PaneDefinitionConfig {
  return {
    pane:     { ...DEFAULT_CONFIG.pane,     ...(overrides.pane     ?? {}) },
    target:   overrides.target ?? DEFAULT_CONFIG.target,
    trigger:  { ...DEFAULT_CONFIG.trigger,  ...(overrides.trigger  ?? {}) },
    context:  { ...DEFAULT_CONFIG.context,  ...(overrides.context  ?? {}) },
    behavior: { ...DEFAULT_CONFIG.behavior, ...(overrides.behavior ?? {}) },
  };
}

export function xrmStub(): IXrmContext {
  return {
    checkWebResourceExists: vi.fn().mockResolvedValue(true),
    webApiGet: vi.fn(),
    webApiGetEntity: vi.fn(),
  };
}
