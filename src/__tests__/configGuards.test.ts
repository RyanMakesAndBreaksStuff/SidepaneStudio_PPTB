import { describe, it, expect, vi } from 'vitest';
import { generateBasicScript } from '../services/CodeGenerationService';
import { parseLookupFieldNames, parseStoredConfig, parseStoredOrgKey } from '../services/configGuards';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';

describe('parseStoredOrgKey (W20)', () => {
  it('reads the org key stored alongside the config without disturbing the config', () => {
    const raw = JSON.stringify({ ...DEFAULT_CONFIG, orgKey: 'orga.crm.dynamics.com' });
    expect(parseStoredOrgKey(raw)).toBe('orga.crm.dynamics.com');
    expect(parseStoredConfig(raw)).toEqual(DEFAULT_CONFIG);
  });

  it('treats a legacy bare config and unusable values as an unknown org', () => {
    expect(parseStoredOrgKey(JSON.stringify(DEFAULT_CONFIG))).toBeNull();
    expect(parseStoredOrgKey(JSON.stringify({ ...DEFAULT_CONFIG, orgKey: '' }))).toBeNull();
    expect(parseStoredOrgKey(JSON.stringify({ ...DEFAULT_CONFIG, orgKey: 7 }))).toBeNull();
    expect(parseStoredOrgKey('{not json')).toBeNull();
    expect(parseStoredOrgKey('[]')).toBeNull();
    expect(parseStoredOrgKey(null)).toBeNull();
  });
});

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
  it('falls back per field for wrong-typed optional target values instead of rejecting the config', () => {
    const base = {
      ...DEFAULT_CONFIG,
      trigger: { ...DEFAULT_CONFIG.trigger, kind: 'ManualJS' },
      context: { ...DEFAULT_CONFIG.context, source: { kind: 'fixed', entityName: '', id: '' } },
    };
    const load = (target: object) => parseStoredConfig(JSON.stringify({ ...base, pane: { ...base.pane, title: 'Kept' }, target }));
    const list = load({ pageType: 'entitylist', entityName: 'account', viewId: 5, viewType: 'other' });
    expect(list?.target).toEqual({ pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' });
    expect(list?.pane.title).toBe('Kept');
    expect(load({ pageType: 'entityrecord', entityName: 'account', formId: null, tabName: 7, data: {} })?.target)
      .toEqual({ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '', createNew: false });
    expect(load({ pageType: 'entityrecord', entityName: 7 })?.target)
      .toEqual({ pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '', createNew: false });
  });
  it('still rejects the whole config when a discriminant or container is unusable', () => {
    for (const bad of [
      { ...DEFAULT_CONFIG, target: 'custom' },
      { ...DEFAULT_CONFIG, target: { pageType: 'wat' } },
      { ...DEFAULT_CONFIG, trigger: null },
      { ...DEFAULT_CONFIG, trigger: { ...DEFAULT_CONFIG.trigger, kind: 'Nope' } },
      { ...DEFAULT_CONFIG, context: { source: { kind: 'wat' } } },
    ]) expect(parseStoredConfig(JSON.stringify(bad))).toBeNull();
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

  it('clears a table record destination the clicked tag decides at runtime', () => {
    const config = {
      ...DEFAULT_CONFIG,
      trigger: { ...DEFAULT_CONFIG.trigger, kind: 'LookupTagClick' },
      host: { ...DEFAULT_CONFIG.host, lookupControls: ['parentaccountid'] },
      target: { pageType: 'entityrecord', entityName: 'account', formId: 'form-1', tabName: 'tab-1', data: '{"a":1}', createNew: false },
      context: { ...DEFAULT_CONFIG.context, source: { kind: 'clickedTag' } },
    };
    expect(parseStoredConfig(JSON.stringify(config))?.target)
      .toEqual({ pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '{"a":1}', createNew: false });
  });

  it('accepts a well-formed config', () => {
    const parsed = parseStoredConfig(JSON.stringify(DEFAULT_CONFIG));
    expect(parsed).toEqual(DEFAULT_CONFIG);
  });

  it('ignores a stored isResizable key that is no longer part of the config', () => {
    const parsed = parseStoredConfig(JSON.stringify({ ...DEFAULT_CONFIG, pane: { ...DEFAULT_CONFIG.pane, isResizable: false } }));
    expect(parsed).toEqual(DEFAULT_CONFIG);
    expect(parsed?.pane).not.toHaveProperty('isResizable');
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

  // C1 — v1 opened context.entityName || target.entityName with the target's form, tab and data (af22472 CodeGenerationService.ts:82).
  const FORM = '11111111-2222-3333-4444-555555555555';
  const contactRecord = { pageType: 'entityrecord', entityName: 'contact', formId: FORM, tabName: 'tab_1', data: '{"a":"b"}' };
  /** Runs the migrated config's Basic script on a contact form or grid row {A1} and returns the navigateTo input. */
  async function opens(raw: string) {
    const config = parseStoredConfig(raw);
    if (!config) throw new Error('The stored config did not load.');
    const pane = { navigate: vi.fn().mockResolvedValue(undefined) };
    const xrm = {
      App: { sidePanes: { state: 0, getPane: vi.fn(), createPane: vi.fn().mockResolvedValue(pane), getAllPanes: vi.fn().mockReturnValue([]) } },
      Navigation: { openErrorDialog: vi.fn(), openAlertDialog: vi.fn() },
    };
    const form = { data: { entity: { getEntityName: () => 'contact', getId: () => '{A1}' } } };
    const row = { getId: () => '{A1}', getEntityName: () => 'contact' };
    const triggerArg = {
      ...form,
      getFormContext: () => form,
      getGrid: () => ({ getSelectedRows: () => ({ getLength: () => 1, get: () => ({ getData: () => ({ getEntity: () => row }) }) }) }),
    };
    const open = new Function('window', 'Xrm', `${generateBasicScript(config)}\nreturn Ns.open;`)({}, xrm) as (arg: unknown) => void;
    open(triggerArg);
    await vi.waitFor(() => expect(pane.navigate).toHaveBeenCalled());
    expect(xrm.Navigation.openErrorDialog).not.toHaveBeenCalled();
    return pane.navigate.mock.calls[0][0];
  }
  it.each([
    ['FormButton', 'CurrentRecord'],
    ['MainGridButton', 'SelectedRow'],
    ['FormOnLoad', 'CurrentRecord'],
  ])('keeps the form, tab and form data of a %s %s Table record target with no context table', async (kind, mode) => {
    const raw = v1({ kind }, { mode, entityName: '' }, contactRecord);
    expect(parseStoredConfig(raw)).toMatchObject({
      host: { entityName: 'contact' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: FORM, tabName: 'tab_1', data: '{"a":"b"}', createNew: false },
    });
    expect(await opens(raw)).toEqual({ pageType: 'entityrecord', entityName: 'contact', entityId: '{A1}', formId: FORM, tabName: 'tab_1', data: { a: 'b' } });
  });
  it('keeps the context table as the host of a RelatedRecord lookup', () => {
    const raw = v1({ kind: 'FormButton' }, { mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' }, contactRecord);
    expect(parseStoredConfig(raw)).toMatchObject({
      host: { entityName: 'account' },
      target: { pageType: 'entityrecord', entityName: 'contact', formId: FORM, tabName: 'tab_1', data: '{"a":"b"}', createNew: false },
      context: { source: { kind: 'lookup', attribute: 'primarycontactid' } },
    });
  });
  it('keeps a Static or None table as the host only where the trigger requires a host', () => {
    expect(parseStoredConfig(v1({ kind: 'FormButton' }, { mode: 'None', entityName: 'account' }))?.host.entityName).toBe('');
    expect(parseStoredConfig(v1({ kind: 'FormOnChange', fieldName: 'name' }, { mode: 'None', entityName: 'account' }))?.host.entityName).toBe('account');
    expect(parseStoredConfig(v1({ kind: 'LookupTagClick', fieldName: 'parentaccountid' }, { mode: 'Static', entityName: 'account' }))?.host.entityName).toBe('account');
  });
  it.each([
    ['another table', 'account', { entityName: 'account', formId: '', tabName: '' }],
    ['the target table', 'contact', { entityName: 'contact', formId: FORM, tabName: 'tab_1' }],
    ['no table', '', { entityName: 'contact', formId: FORM, tabName: 'tab_1' }],
  ])('opens the table v1 opened for a Static record named with %s', async (_label, contextTable, kept) => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const raw = v1({ kind: 'FormButton' }, { mode: 'Static', entityName: contextTable, staticRecordId: id }, contactRecord);
    const v1Table = contextTable || contactRecord.entityName;
    expect(parseStoredConfig(raw)).toMatchObject({
      host: { entityName: '' },
      target: { pageType: 'entityrecord', data: '{"a":"b"}', createNew: false, ...kept },
      context: { source: { kind: 'fixed', entityName: contextTable, id } },
    });
    const input = await opens(raw);
    expect(input.entityName).toBe(v1Table);
    expect(input).toEqual({
      pageType: 'entityrecord', entityName: v1Table, entityId: id, data: { a: 'b' },
      ...(kept.formId ? { formId: FORM, tabName: 'tab_1' } : {}),
    });
  });
});

describe('parseLookupFieldNames', () => {
  it('splits, trims, and de-duplicates a comma-separated list', () => {
    expect(parseLookupFieldNames(' parentcustomerid ,primarycontactid,, parentcustomerid ')).toEqual(['parentcustomerid', 'primarycontactid']);
  });
});
