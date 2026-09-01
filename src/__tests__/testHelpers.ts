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
    isAvailable: true,
    sidePanesAvailable: true,
    createPane: vi.fn(),
    getPane: vi.fn(),
    getHostKind: () => 'Unknown',
    checkWebResourceExists: vi.fn().mockResolvedValue(true),
    readEnvVar: vi.fn().mockResolvedValue(null),
    getCurrentAppId: vi.fn(() => null),
    getCurrentUserId: vi.fn().mockResolvedValue('user-1'),
    webApiGet: vi.fn(),
    webApiGetEntity: vi.fn(),
    dataverseExecute: vi.fn(),
    getAllEntitiesMetadata: vi.fn().mockResolvedValue([]),
  };
}
