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
});
