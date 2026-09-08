import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { generateBasicScript, generateLibraryScript } from '../services/CodeGenerationService';
import { validate } from '../services/ValidationService';
import { parseStoredConfig } from '../services/configGuards';
import runtimeSource from '../runtime/sidepane.runtime.js?raw';

const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const otherId = '11111111-2222-3333-4444-555555555555';
function config(target: object): PaneDefinitionConfig {
  return {
    ...DEFAULT_CONFIG,
    target,
    context: { ...DEFAULT_CONFIG.context, mode: 'Static', staticRecordId: id },
    trigger: { ...DEFAULT_CONFIG.trigger, kind: 'ManualJS', namespace: 'ParameterTest', functionName: 'open' },
  } as PaneDefinitionConfig;
}
async function navigate(c: PaneDefinitionConfig, library: boolean) {
  const navigation = vi.fn().mockResolvedValue(undefined);
  const error = vi.fn();
  vi.stubGlobal('Xrm', {
    App: { sidePanes: { getPane: () => undefined, createPane: async () => ({ navigate: navigation }), state: 0 } },
    Navigation: { openErrorDialog: error },
  });
  const primaryControl = { getGrid: () => ({ getSelectedRows: () => ({
    getLength: () => 1,
    get: () => ({ getData: () => ({ getEntity: () => ({ getId: () => otherId }) }) }),
  }) }) };
  if (library) {
    (0, eval)(runtimeSource);
    new Function('primaryControl', `${generateLibraryScript(c)}; return ParameterTest.open(primaryControl);`)(primaryControl);
  } else if (c.trigger.kind === 'MainGridButton' || c.trigger.kind === 'SubgridButton') {
    new Function('primaryControl', `${generateBasicScript(c)}; return ParameterTest.open(primaryControl);`)(primaryControl);
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
  it.each(['MainGridButton', 'SubgridButton'] as const)('delivers selected row parameters from %s through both outputs', async kind => {
    const c = config({ pageType: 'entityrecord', entityName: 'account', formId: id, tabName: '', data: '' });
    c.trigger.kind = kind;
    c.context.mode = 'SelectedRow';
    const expected = { pageType: 'entityrecord', entityName: 'account', entityId: otherId, formId: id };
    expect(await navigate(c, false)).toEqual(expected);
    expect(await navigate(c, true)).toEqual(expected);
  });
  it.each(['savedquery', 'userquery'])('delivers %s view identically', async viewType => {
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
  it('omits blank optional parameters and uses one configured ID in None mode', async () => {
    const c = config({ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' });
    c.context.mode = 'None';
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
    c.context.mode = 'None';
    c.context.staticRecordId = '';
    c.trigger.kind = 'FormButton';
    expect(validate(c).errors.map(e => e.field)).toContain('context.staticRecordId');
  });
  it('migrates legacy target ID without overriding the existing context ID', () => {
    const legacy = config({ pageType: 'entityrecord', entityName: 'account', entityId: otherId });
    expect(parseStoredConfig(JSON.stringify(legacy))?.context.staticRecordId).toBe(id);
    legacy.context.staticRecordId = '';
    const migrated = parseStoredConfig(JSON.stringify(legacy));
    expect(migrated?.context.staticRecordId).toBe(otherId);
    expect(migrated?.target).toEqual({ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' });
    expect(parseStoredConfig(JSON.stringify(config({ pageType: 'entitylist', entityName: 'account' })))?.target).toEqual({ pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' });
  });
  it('rejects wrong-shaped new settings values', () => {
    for (const target of [
      { pageType: 'entityrecord', entityName: 'account', formId: 3 },
      { pageType: 'entityrecord', entityName: 'account', data: {} },
      { pageType: 'entitylist', entityName: 'account', viewType: 'other' },
      { pageType: 'entitylist', entityName: 'account', viewId: [] },
    ]) expect(parseStoredConfig(JSON.stringify(config(target)))).toBeNull();
  });
});