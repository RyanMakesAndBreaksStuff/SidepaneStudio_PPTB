import { describe, it, expect } from 'vitest';
import { parseLookupFieldNames, parseStoredConfig } from '../services/configGuards';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';

describe('parseStoredConfig', () => {
  it('round-trips a generative page target and defaults wrong-typed fields', () => {
    const target = { pageType: 'generative', pageId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', data: '{"a":1}' };
    expect(parseStoredConfig(JSON.stringify({ ...DEFAULT_CONFIG, target }))?.target).toEqual(target);
    expect(parseStoredConfig(JSON.stringify({ ...DEFAULT_CONFIG, target: { pageType: 'generative', pageId: 7 } }))?.target)
      .toEqual({ pageType: 'generative', pageId: '', data: '' });
  });
  it('loads entity record create mode and back-fills it as off for older configs', () => {
    const target = { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '' };
    const load = (t: object) => parseStoredConfig(JSON.stringify({ ...DEFAULT_CONFIG, target: t }))?.target;
    expect(load(target)).toEqual({ ...target, createNew: false });
    expect(load({ ...target, createNew: true, createFromCurrent: true })).toEqual({ ...target, createNew: true });
    expect(load({ ...target, createNew: 'yes', createFromCurrent: 1 })).toEqual({ ...target, createNew: false });
  });
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

  it('accepts a stored LookupTagClick trigger', () => {
    const config = {
      ...DEFAULT_CONFIG,
      trigger: { ...DEFAULT_CONFIG.trigger, kind: 'LookupTagClick' },
      host: { ...DEFAULT_CONFIG.host, lookupControls: ['parentaccountid'] },
    };
    expect(parseStoredConfig(JSON.stringify(config))?.trigger.kind).toBe('LookupTagClick');
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

  it('back-fills toggleIfOpen as off for older configs and keeps a stored value', () => {
    const load = (behavior: object) => parseStoredConfig(JSON.stringify({ ...DEFAULT_CONFIG, behavior }))?.behavior.toggleIfOpen;
    expect(load({ expandOnOpen: true, closeOthers: false })).toBe(false);
    expect(load({ expandOnOpen: true, closeOthers: false, toggleIfOpen: true })).toBe(true);
  });

  it('round-trips a lookup record source', () => {
    const context = { ...DEFAULT_CONFIG.context, source: { kind: 'lookup', attribute: 'primarycontactid' } };
    expect(parseStoredConfig(JSON.stringify({ ...DEFAULT_CONFIG, context }))?.context).toEqual(context);
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
      host: { ...DEFAULT_CONFIG.host, entityName: 7 },
      context: { ...DEFAULT_CONFIG.context, variableName: 3 },
      behavior: { expandOnOpen: 'yes', closeOthers: 1, reuseExistingPane: 'yes' },
    });
    const parsed = parseStoredConfig(raw);
    expect(parsed?.pane.title).toBe(DEFAULT_CONFIG.pane.title);
    expect(parsed?.pane.canClose).toBe(DEFAULT_CONFIG.pane.canClose);
    expect(parsed?.pane.badgeValue).toBe(DEFAULT_CONFIG.pane.badgeValue);
    expect(parsed?.target).toEqual({ pageType: 'custom', name: '' });
    expect(parsed?.trigger.namespace).toBe(DEFAULT_CONFIG.trigger.namespace);
    expect(parsed?.trigger.functionName).toBe(DEFAULT_CONFIG.trigger.functionName);
    expect(parsed?.host.entityName).toBe('');
    expect(parsed?.context.variableName).toBe('recordId');
    expect(parsed?.behavior.reuseExistingPane).toBe(DEFAULT_CONFIG.behavior.reuseExistingPane);
    expect(parsed?.behavior).toEqual(DEFAULT_CONFIG.behavior);
  });
});

describe('v1 migration', () => {
  const v1 = (trigger: object, context: object, target: object = { pageType: 'custom', name: 'sps_Page' }) => JSON.stringify({
    pane: DEFAULT_CONFIG.pane, behavior: { expandOnOpen: true, closeOthers: false, toggleIfOpen: false },
    trigger: { functionName: 'open', namespace: 'Ns', fieldName: '', ...trigger }, context, target,
  });
  it('migrates all four grid trigger kinds and surfaces', () => {
    for (const [legacy, kind, surface] of [
      ['MainGridButton', 'GridButton', 'main'], ['SubgridButton', 'GridButton', 'subgrid'],
      ['MainGridOnSelect', 'GridRowSelect', 'main'], ['SubgridOnSelect', 'GridRowSelect', 'subgrid'],
    ]) {
      expect(parseStoredConfig(v1({ kind: legacy }, { mode: 'CurrentRecord', entityName: 'account' })))
        .toMatchObject({ trigger: { kind, surface }, host: { entityName: 'account' }, context: { source: { kind: 'selectedRow' } } });
    }
  });
  it('migrates context modes and console records', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(parseStoredConfig(v1({ kind: 'FormButton' }, { mode: 'CurrentRecord' }))?.context.source).toEqual({ kind: 'host' });
    expect(parseStoredConfig(v1({ kind: 'FormButton' }, { mode: 'Static', entityName: 'account', staticRecordId: id }))?.context.source).toEqual({ kind: 'fixed', entityName: 'account', id });
    expect(parseStoredConfig(v1({ kind: 'FormButton' }, { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' })))
      .toMatchObject({ host: { entityName: 'account' }, context: { source: { kind: 'lookup', attribute: 'primarycontactid' } } });
    expect(parseStoredConfig(v1({ kind: 'FormButton' }, { mode: 'None' }))?.context.source).toEqual({ kind: 'none' });
    expect(parseStoredConfig(v1({ kind: 'ManualJS' }, { mode: 'CurrentRecord' }))?.context.source).toEqual({ kind: 'none' });
    expect(parseStoredConfig(v1({ kind: 'ManualJS' }, { mode: 'CurrentRecord', staticRecordId: id }))?.context.source).toEqual({ kind: 'fixed', entityName: '', id });
  });
  it('moves watched columns, lookup controls and pane reuse', () => {
    expect(parseStoredConfig(v1({ kind: 'FormOnChange', fieldName: 'name' }, { mode: 'CurrentRecord', entityName: 'account', reuseExistingPane: false })))
      .toMatchObject({ host: { attribute: 'name', lookupControls: [] }, behavior: { reuseExistingPane: false } });
    expect(parseStoredConfig(v1({ kind: 'LookupTagClick', fieldName: 'a, b ,a' }, { mode: 'CurrentRecord' })))
      .toMatchObject({ host: { lookupControls: ['a', 'b'] }, context: { source: { kind: 'clickedTag' } } });
  });
  it('migrates create-mode prefill into the source', () => {
    const create = { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true };
    expect(parseStoredConfig(v1({ kind: 'FormButton' }, { mode: 'CurrentRecord' }, { ...create, createFromCurrent: true }))?.context.source).toEqual({ kind: 'host' });
    expect(parseStoredConfig(v1({ kind: 'FormButton' }, { mode: 'CurrentRecord' }, { ...create, createFromCurrent: false }))?.context.source).toEqual({ kind: 'none' });
  });
  it('round-trips v2 and rejects unknown source discriminants', () => {
    const c = { ...DEFAULT_CONFIG, host: { ...DEFAULT_CONFIG.host, entityName: 'account', lookupControls: ['x'] }, context: { source: { kind: 'lookup', attribute: 'primarycontactid' }, variableName: 'rec' } };
    expect(parseStoredConfig(JSON.stringify(c))).toEqual(c);
    expect(parseStoredConfig(JSON.stringify({ ...DEFAULT_CONFIG, context: { source: { kind: 'wat' } } }))).toBeNull();
  });
});

describe('parseLookupFieldNames', () => {
  it('splits, trims, and de-duplicates a comma-separated list', () => {
    expect(parseLookupFieldNames(' parentcustomerid ,primarycontactid,, parentcustomerid ')).toEqual(['parentcustomerid', 'primarycontactid']);
  });
});
