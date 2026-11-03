import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, PaneDefinitionConfig, TargetConfig } from '../types/PaneDefinitionConfig';
import { generateBasicScript, generateLibraryScript } from '../services/CodeGenerationService';
import { validate } from '../services/ValidationService';
import { parseStoredConfig } from '../services/configGuards';
import runtimeSource from '../runtime/sidepane.runtime.js?raw';

const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const otherId = '11111111-2222-3333-4444-555555555555';
function config(target: TargetConfig): PaneDefinitionConfig {
  return {
    ...DEFAULT_CONFIG,
    target,
    context: { ...DEFAULT_CONFIG.context, source: { kind: 'fixed', entityName: '', id } },
    trigger: { ...DEFAULT_CONFIG.trigger, kind: 'ManualJS', namespace: 'ParameterTest', functionName: 'open' },
  };
}
/** A stored config as JSON, whose target (and legacy fields) may not match the current types. */
function stored(target: object, overrides: object = {}): string {
  return JSON.stringify({ ...config(DEFAULT_CONFIG.target), target, ...overrides });
}
async function navigate(c: PaneDefinitionConfig, library: boolean) {
  const navigation = vi.fn().mockResolvedValue(undefined);
  const error = vi.fn();
  vi.stubGlobal('Xrm', {
    App: { sidePanes: { getPane: () => undefined, createPane: async () => ({ navigate: navigation }), state: 0 } },
    Navigation: { openErrorDialog: error },
  });
  const selectedControl = { getGrid: () => ({ getSelectedRows: () => ({
    getLength: () => 1,
    get: () => ({ getData: () => ({ getEntity: () => ({ getId: () => otherId, getEntityName: () => 'account' }) }) }),
  }) }) };
  const executionContext = { getEventSource: () => ({ getId: () => otherId, getEntityName: () => 'account' }) };
  const onSelect = c.trigger.kind === 'GridRowSelect';
  if (library) {
    (0, eval)(runtimeSource);
    if (onSelect) {
      new Function('executionContext', `${generateLibraryScript(c)}; return ParameterTest.open(executionContext);`)(executionContext);
    } else if (c.trigger.kind === 'GridButton') {
      new Function('selectedControl', `${generateLibraryScript(c)}; return ParameterTest.open(selectedControl);`)(selectedControl);
    } else {
      // ManualJS library output calls itself, as the Basic console snippet does.
      new Function(generateLibraryScript(c))();
    }
  } else if (c.trigger.kind === 'GridButton') {
    new Function('selectedControl', `${generateBasicScript(c)}; return ParameterTest.open(selectedControl);`)(selectedControl);
  } else if (onSelect) {
    new Function('executionContext', `${generateBasicScript(c)}; return ParameterTest.open(executionContext);`)(executionContext);
  } else {
    new Function(generateBasicScript(c))();
  }
  await vi.waitFor(() => expect(navigation).toHaveBeenCalledTimes(1));
  expect(error).not.toHaveBeenCalled();
  return navigation.mock.calls[0][0];
}
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, 'SidePaneHelper');
});

describe('page parameter contract', () => {
  it('opens a blank create-mode form with pre-filled data through both outputs', async () => {
    const c = config({ pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '{"firstname":"Pat"}', createNew: true });
    c.context.source = { kind: 'none' };
    for (const library of [false, true]) {
      const input = await navigate(c, library);
      expect(input).toEqual({ pageType: 'entityrecord', entityName: 'contact', data: { firstname: 'Pat' } });
      expect(input).not.toHaveProperty('entityId');
    }
  });
  it.each([
    ['GridButton', 'main'], ['GridButton', 'subgrid'], ['GridRowSelect', 'main'], ['GridRowSelect', 'subgrid'],
  ] as const)('delivers selected row parameters from %s on the %s grid through both outputs', async (kind, surface) => {
    const c = config({ pageType: 'entityrecord', entityName: 'account', formId: id, tabName: '', data: '' });
    c.trigger.kind = kind;
    c.trigger.surface = surface;
    c.host.entityName = 'account';
    c.context.source = { kind: 'selectedRow' };
    const expected = { pageType: 'entityrecord', entityName: 'account', entityId: otherId, formId: id };
    expect(await navigate(c, false)).toEqual(expected);
    expect(await navigate(c, true)).toEqual(expected);
  });
  it.each(['savedquery', 'userquery'] as const)('delivers %s view identically', async viewType => {
    const c = config({ pageType: 'entitylist', entityName: 'account', viewId: `{${otherId}}`, viewType });
    const expected = { pageType: 'entitylist', entityName: 'account', viewId: otherId, viewType };
    expect(await navigate(c, false)).toEqual(expected);
    expect(await navigate(c, true)).toEqual(expected);
  });
  it('delivers record parameters as an object, preserving escaped values', async () => {
    const c = config({ pageType: 'entityrecord', entityName: 'account', formId: `{${otherId}}`, tabName: 'tab_"details', data: '{"name":"O\'Brien","new_flag":false}' });
    const expected = { pageType: 'entityrecord', entityName: 'account', entityId: id, formId: otherId, tabName: 'tab_"details', data: { name: "O'Brien", new_flag: false } };
    expect(await navigate(c, false)).toEqual(expected);
    expect(await navigate(c, true)).toEqual(expected);
  });
  it('omits blank optional parameters and uses the one configured ID', async () => {
    const c = config({ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' });
    expect(await navigate(c, false)).toEqual({ pageType: 'entityrecord', entityName: 'account', entityId: id });
    expect(await navigate(c, true)).toEqual(await navigate(c, false));
  });
  it.each(['bad', '[]', 'null', '42'])('blocks invalid dictionary %s', data => {
    const c = config({ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data });
    expect(validate(c).errors).toContainEqual({ field: 'target.data', message: 'Form data must be a JSON object.' });
    expect(() => generateBasicScript(c)).not.toThrow();
    expect(() => generateLibraryScript(c)).not.toThrow();
  });
  it('requires valid view/form GUIDs and the view type pair', () => {
    expect(validate(config({ pageType: 'entitylist', entityName: 'account', viewId: 'bad', viewType: '' })).errors.map(e => e.field)).toEqual(expect.arrayContaining(['target.viewId', 'target.viewType']));
    expect(validate(config({ pageType: 'entityrecord', entityName: 'account', formId: 'bad', tabName: '', data: '' })).errors.map(e => e.field)).toContain('target.formId');
    const c = config({ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' });
    c.context.source = { kind: 'none' };
    c.trigger.kind = 'FormButton';
    expect(validate(c).errors.map(e => e.field)).toContain('context.source');
  });
  it('migrates legacy target ID without overriding the existing context ID', () => {
    const legacyTarget = { pageType: 'entityrecord', entityName: 'account', entityId: otherId };
    const legacyContext = { mode: 'Static', entityName: '', staticRecordId: id };
    expect(parseStoredConfig(stored(legacyTarget, { context: legacyContext }))?.context.source).toEqual({ kind: 'fixed', entityName: '', id });
    const migrated = parseStoredConfig(stored(legacyTarget, { context: { ...legacyContext, staticRecordId: '' } }));
    expect(migrated?.context.source).toEqual({ kind: 'fixed', entityName: '', id: otherId });
    expect(migrated?.target).toEqual({ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '', createNew: false });
    expect(parseStoredConfig(stored({ pageType: 'entitylist', entityName: 'account' }))?.target).toEqual({ pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' });
  });
  it('rejects wrong-shaped new settings values', () => {
    for (const target of [
      { pageType: 'entityrecord', entityName: 'account', formId: 3 },
      { pageType: 'entityrecord', entityName: 'account', data: {} },
      { pageType: 'entitylist', entityName: 'account', viewType: 'other' },
      { pageType: 'entitylist', entityName: 'account', viewId: [] },
    ]) expect(parseStoredConfig(stored(target))).toBeNull();
  });

  it('pre-fills a new record from the selected grid row through both outputs', async () => {
    const c = config({ pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true });
    c.trigger.kind = 'GridButton';
    c.host.entityName = 'account';
    c.context.source = { kind: 'selectedRow' };
    const expected = { pageType: 'entityrecord', entityName: 'contact', createFromEntity: { entityType: 'account', id: otherId } };
    expect(await navigate(c, false)).toEqual(expected);
    expect(await navigate(c, true)).toEqual(expected);
  });
});

describe('generative page contract', () => {
  const generative: TargetConfig = { pageType: 'generative', pageId: `{${otherId}}`, data: '{"status":"open"}' };

  it('sends pageId, the record pair, and data through both outputs', async () => {
    const c = config(generative);
    c.context.source = { kind: 'fixed', entityName: 'account', id };
    const expected = { pageType: 'generative', pageId: otherId, entityName: 'account', recordId: id, data: { status: 'open' } };
    expect(await navigate(c, false)).toEqual(expected);
    expect(await navigate(c, true)).toEqual(expected);
  });

  it('sends neither record field when the table is unknown', async () => {
    const c = config({ ...generative, data: '' });
    const expected = { pageType: 'generative', pageId: otherId };
    expect(await navigate(c, false)).toEqual(expected);
    expect(await navigate(c, true)).toEqual(expected);
  });
});
