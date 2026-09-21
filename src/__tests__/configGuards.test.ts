import { describe, it, expect } from 'vitest';
import { parseStoredConfig } from '../services/configGuards';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';

describe('parseStoredConfig', () => {
  it('rejects malformed JSON', () => {
    expect(parseStoredConfig('{not json')).toBeNull();
  });

  it('rejects valid JSON of the wrong shape', () => {
    expect(parseStoredConfig('{"hello":"world"}')).toBeNull();
    expect(parseStoredConfig('[]')).toBeNull();
    expect(parseStoredConfig('null')).toBeNull();
  });

  it('rejects an unknown pageType or trigger kind', () => {
    const bad = { ...DEFAULT_CONFIG, target: { pageType: 'wat', name: 'x' } };
    expect(parseStoredConfig(JSON.stringify(bad))).toBeNull();

    const badTrigger = { ...DEFAULT_CONFIG, trigger: { ...DEFAULT_CONFIG.trigger, kind: 'Nope' } };
    expect(parseStoredConfig(JSON.stringify(badTrigger))).toBeNull();
  });

  it('accepts a well-formed config', () => {
    const parsed = parseStoredConfig(JSON.stringify(DEFAULT_CONFIG));
    expect(parsed).toEqual(DEFAULT_CONFIG);
  });

  it('fills sections missing from an older stored config', () => {
    const legacy = { ...DEFAULT_CONFIG } as Record<string, unknown>;
    delete legacy.behavior;
    const parsed = parseStoredConfig(JSON.stringify(legacy));
    expect(parsed?.behavior).toEqual(DEFAULT_CONFIG.behavior);
  });

  it.each([
    [299, 300],
    [1201, 1200],
    [Number.NaN, DEFAULT_CONFIG.pane.width],
    [Number.POSITIVE_INFINITY, DEFAULT_CONFIG.pane.width],
    ['480;globalThis.pwned=1', DEFAULT_CONFIG.pane.width],
  ] as const)('normalizes stored width %p to %p', (width, expected) => {
    const raw = JSON.stringify({ ...DEFAULT_CONFIG, pane: { ...DEFAULT_CONFIG.pane, width } });
    expect(parseStoredConfig(raw)?.pane.width).toBe(expected);
  });

  it('does not preserve wrong primitive types from accepted stored sections', () => {
    const raw = JSON.stringify({
      ...DEFAULT_CONFIG,
      pane: { ...DEFAULT_CONFIG.pane, title: 42, canClose: 'yes', badgeValue: {} },
      target: { pageType: 'custom', name: 7 },
      trigger: { ...DEFAULT_CONFIG.trigger, namespace: {}, functionName: null },
      context: { ...DEFAULT_CONFIG.context, entityName: 7, reuseExistingPane: 'yes' },
      behavior: { expandOnOpen: 'yes', closeOthers: 1 },
    });
    const parsed = parseStoredConfig(raw);
    expect(parsed?.pane.title).toBe(DEFAULT_CONFIG.pane.title);
    expect(parsed?.pane.canClose).toBe(DEFAULT_CONFIG.pane.canClose);
    expect(parsed?.pane.badgeValue).toBe(DEFAULT_CONFIG.pane.badgeValue);
    expect(parsed?.target).toEqual({ pageType: 'custom', name: '' });
    expect(parsed?.trigger.namespace).toBe(DEFAULT_CONFIG.trigger.namespace);
    expect(parsed?.trigger.functionName).toBe(DEFAULT_CONFIG.trigger.functionName);
    expect(parsed?.context.entityName).toBe('');
    expect(parsed?.context.reuseExistingPane).toBe(DEFAULT_CONFIG.context.reuseExistingPane);
    expect(parsed?.behavior).toEqual(DEFAULT_CONFIG.behavior);
  });
});
