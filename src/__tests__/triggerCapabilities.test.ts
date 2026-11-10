import { describe, expect, it } from 'vitest';
import { allowedSources, allowedTargets, coerceConfig, destinationTable, retargetRecord, TRIGGER_CAPABILITIES, TRIGGER_KINDS } from '../services/triggerCapabilities';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { validate } from '../services/ValidationService';
import { cfg } from './testHelpers';

const record = { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' } as const;

describe('retargetRecord', () => {
  const picked = { pageType: 'entityrecord', entityName: 'account', formId: 'form-1', tabName: 'tab-1', data: '{"name":"A"}', createNew: false } as const;
  it('moves to the new table and clears its form, tab and form data', () => {
    expect(retargetRecord(picked, 'contact')).toEqual({ ...picked, entityName: 'contact', formId: '', tabName: '', data: '' });
  });
  it('keeps form data written before any table was chosen', () => {
    expect(retargetRecord({ ...picked, entityName: '' }, 'contact')).toEqual({ ...picked, entityName: 'contact', formId: '', tabName: '' });
  });
  it('keeps form data when the table is unchanged, but still clears the form and tab', () => {
    expect(retargetRecord(picked, 'account')).toEqual({ ...picked, formId: '', tabName: '' });
  });
  it('returns a new object and leaves its input untouched', () => {
    const before = { ...picked };
    const next = retargetRecord(picked, 'contact');
    expect(next).not.toBe(picked);
    expect(picked).toEqual(before);
  });
});

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
  it('lists no record before a specific record for the console on content that does not need one', () => {
    for (const target of [
      { pageType: 'custom', name: 'sps_Page' },
      { pageType: 'webresource', name: 'sps_/p.html' },
      { pageType: 'generative', pageId: '', data: '' },
    ] as const) expect(allowedSources(cfg({ trigger: { kind: 'ManualJS' }, target }))).toEqual(['none', 'fixed']);
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
    const c = cfg({ trigger: { kind: 'ManualJS' }, target: record, context: { source: { kind: 'host' } } });
    expect(coerceConfig(c).context.source).toEqual({ kind: 'fixed', entityName: '', id: '' });
    const tag = cfg({ trigger: { kind: 'LookupTagClick' }, context: { source: { kind: 'none' } } });
    expect(coerceConfig(tag).context.source).toEqual({ kind: 'clickedTag' });
  });
  it('snaps a trigger change to the console onto No record, which needs nothing more, for a custom page', () => {
    const snapped = coerceConfig(cfg({ trigger: { kind: 'ManualJS' }, context: { source: { kind: 'host' } } }));
    expect(snapped.context.source).toEqual({ kind: 'none' });
    expect(validate(snapped).errors.map(error => error.field)).not.toContain('context.source.id');
    expect(validate(snapped).errors.map(error => error.field)).not.toContain('context.source.entityName');
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
