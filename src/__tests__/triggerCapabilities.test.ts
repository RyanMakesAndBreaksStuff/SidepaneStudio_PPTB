import { describe, expect, it } from 'vitest';
import { allowedSources, allowedTargets, coerceConfig, destinationTable, TRIGGER_CAPABILITIES, TRIGGER_KINDS } from '../services/triggerCapabilities';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { cfg } from './testHelpers';

const record = { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' } as const;

describe('capability table', () => {
  it('lists exactly the seven v2 trigger kinds', () => {
    expect(TRIGGER_KINDS).toEqual(['FormOnLoad', 'FormButton', 'FormOnChange', 'LookupTagClick', 'GridButton', 'GridRowSelect', 'ManualJS']);
  });
  it('hides Table list from grid triggers and offers the grid preview only there', () => {
    for (const kind of ['GridButton', 'GridRowSelect'] as const) {
      expect(allowedTargets(kind)).not.toContain('entitylist');
      expect(TRIGGER_CAPABILITIES[kind].gridPreview).toBe(true);
    }
    expect(allowedTargets('FormButton')).toContain('entitylist');
    expect(TRIGGER_CAPABILITIES.FormButton.gridPreview).toBe(false);
  });
});

describe('allowedSources', () => {
  it('offers no record for list, dashboard and search targets', () => {
    for (const target of [
      { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' },
      { pageType: 'dashboard', dashboardId: 'd', dashboardName: 'D' },
      { pageType: 'search', searchText: '' },
    ] as const) expect(allowedSources(cfg({ target }))).toEqual(['none']);
  });
  it('requires a record to open an existing table record and leaves only fixed for the console', () => {
    expect(allowedSources(cfg({ trigger: { kind: 'FormButton' }, target: record }))).toEqual(['host', 'lookup', 'fixed']);
    expect(allowedSources(cfg({ trigger: { kind: 'ManualJS' }, target: record }))).toEqual(['fixed']);
  });
  it('limits create mode to a pre-fill source or none', () => {
    expect(allowedSources(cfg({ trigger: { kind: 'GridButton' }, target: { ...record, createNew: true } }))).toEqual(['selectedRow', 'none']);
    expect(allowedSources(cfg({ trigger: { kind: 'LookupTagClick' }, target: { ...record, createNew: true } }))).toEqual(['none']);
  });
  it('locks the lookup tag trigger to the clicked tag', () => {
    expect(allowedSources(cfg({ trigger: { kind: 'LookupTagClick' } }))).toEqual(['clickedTag']);
  });
});

describe('coerceConfig', () => {
  it('returns the same object when nothing is illegal', () => {
    expect(coerceConfig(DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG);
  });
  it('snaps the target when the trigger cannot open it', () => {
    const c = cfg({ trigger: { kind: 'GridButton' }, target: { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' } });
    expect(coerceConfig(c).target).toEqual({ pageType: 'custom', name: '' });
  });
  it('snaps the source to the first legal kind', () => {
    const c = cfg({ trigger: { kind: 'ManualJS' }, context: { source: { kind: 'host' } } });
    expect(coerceConfig(c).context.source).toEqual({ kind: 'fixed', entityName: '', id: '' });
    const tag = cfg({ trigger: { kind: 'LookupTagClick' }, context: { source: { kind: 'none' } } });
    expect(coerceConfig(tag).context.source).toEqual({ kind: 'clickedTag' });
  });
  it('derives the destination table from the host for form-record and selected-row sources', () => {
    const c: PaneDefinitionConfig = cfg({ host: { entityName: 'account' }, target: record, context: { source: { kind: 'host' } } });
    const next = coerceConfig(c);
    expect(next.target).toEqual({ ...record, entityName: 'account' });
    expect(destinationTable(next)).toBe('account');
    expect(destinationTable(cfg({ target: record, context: { source: { kind: 'fixed', entityName: '', id: '' } } }))).toBe('contact');
  });
  it('clears form data when the derived destination replaces a known table, and keeps it on a first derivation', () => {
    const withData = { ...record, data: '{"firstname":"A"}' };
    const replaced = coerceConfig(cfg({ host: { entityName: 'account' }, target: withData, context: { source: { kind: 'host' } } }));
    expect(replaced.target).toEqual({ ...record, entityName: 'account', data: '' });
    const first = coerceConfig(cfg({ host: { entityName: 'account' }, target: { ...withData, entityName: '' }, context: { source: { kind: 'host' } } }));
    expect(first.target).toEqual({ ...withData, entityName: 'account' });
  });
});
