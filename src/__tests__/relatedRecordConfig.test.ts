import { describe, expect, it } from 'vitest';
import { applyLookup, changeHostTable } from '../services/relatedRecordConfig';
import { cfg } from './testHelpers';

function relatedConfig() {
  return cfg({
    host: { entityName: 'account' },
    target: { pageType: 'entityrecord', entityName: 'account', formId: 'form-id', tabName: 'details', data: '{"name":"keep"}' },
    context: { source: { kind: 'lookup', attribute: 'primarycontactid' } },
  });
}

describe('related record configuration transitions', () => {
  it('returns the original config when the source is not a lookup', () => {
    const config = cfg({ host: { entityName: 'account' }, context: { source: { kind: 'host' } } });
    expect(applyLookup(config, 'account', { LogicalName: 'primarycontactid', Targets: ['contact'] })).toBe(config);
  });

  it('returns the original config when the host table is unchanged', () => {
    const config = relatedConfig();
    expect(changeHostTable(config, 'account')).toBe(config);
  });

  it('clears lookup and table-specific destination selections when the host changes', () => {
    const config = relatedConfig();
    const changed = changeHostTable(config, 'contact');
    expect(changed).not.toBe(config);
    expect(changed.host.entityName).toBe('contact');
    expect(changed.context.source).toEqual({ kind: 'lookup', attribute: '' });
    expect(changed.target).toMatchObject({ pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '' });
  });

  it('derives one destination from the lookup and clears incompatible form, tab and form data', () => {
    const changed = applyLookup(relatedConfig(), 'account', {
      LogicalName: 'primarycontactid', Targets: ['contact'],
    });
    expect(changed.context.source).toEqual({ kind: 'lookup', attribute: 'primarycontactid' });
    expect(changed.target).toMatchObject({ pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' });
  });

  it('keeps form data when the lookup first resolves a destination or resolves the same one', () => {
    const unresolved = cfg({ ...relatedConfig(), target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '{"name":"keep"}' } });
    const first = applyLookup(unresolved, 'account', { LogicalName: 'primarycontactid', Targets: ['contact'] });
    expect(first.target).toMatchObject({ entityName: 'contact', data: '{"name":"keep"}' });
    const same = cfg({ ...relatedConfig(), target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '{"name":"keep"}' } });
    const again = applyLookup(same, 'account', { LogicalName: 'primarycontactid', Targets: ['contact'] });
    expect(again.target).toMatchObject({ entityName: 'contact', data: '{"name":"keep"}' });
  });

  it('leaves multi-target destination table unset without choosing the first target', () => {
    const changed = applyLookup(relatedConfig(), 'account', {
      LogicalName: 'parentcustomerid', Targets: ['account', 'contact', 'account'],
    });
    expect(changed.context.source).toEqual({ kind: 'lookup', attribute: 'parentcustomerid' });
    expect(changed.target).toMatchObject({ pageType: 'entityrecord', entityName: '', formId: '', tabName: '' });
  });

  it('does not invent a destination when target metadata is absent', () => {
    const changed = applyLookup(relatedConfig(), 'account', { LogicalName: 'untypedlookup' });
    expect(changed.context.source).toEqual({ kind: 'lookup', attribute: 'untypedlookup' });
    expect(changed.target).toMatchObject({ pageType: 'entityrecord', entityName: '', formId: '', tabName: '' });
  });

  it('ignores lookup results for a host that is no longer current', () => {
    const config = cfg({ host: { entityName: 'contact' }, context: { source: { kind: 'lookup', attribute: '' } } });
    expect(applyLookup(config, 'account', { LogicalName: 'primarycontactid', Targets: ['contact'] })).toBe(config);
  });

  it('derives the destination from the host for a form-record source', () => {
    const config = cfg({ host: { entityName: 'account' }, target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '' }, context: { source: { kind: 'host' } } });
    expect(changeHostTable(config, 'contact').target).toMatchObject({ entityName: 'contact', formId: '', tabName: '' });
  });
});
