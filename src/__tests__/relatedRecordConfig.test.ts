import { describe, expect, it } from 'vitest';
import { applyRelatedLookup, changeRelatedSource } from '../services/relatedRecordConfig';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';

function relatedConfig(overrides: Partial<PaneDefinitionConfig> = {}): PaneDefinitionConfig {
  return {
    ...DEFAULT_CONFIG,
    target: { pageType: 'entityrecord', entityName: 'account', formId: 'form-id', tabName: 'details', data: '{"name":"keep"}' },
    context: { ...DEFAULT_CONFIG.context, mode: 'RelatedRecord', entityName: 'account', lookupAttribute: 'primarycontactid' },
    ...overrides,
  };
}

describe('related record configuration transitions', () => {
  it('returns the original config when the context is not RelatedRecord', () => {
    const config = relatedConfig({ context: { ...DEFAULT_CONFIG.context, mode: 'CurrentRecord', entityName: 'account', lookupAttribute: 'primarycontactid' } });
    expect(changeRelatedSource(config, 'contact')).toBe(config);
    expect(applyRelatedLookup(config, 'account', { LogicalName: 'primarycontactid', Targets: ['contact'] })).toBe(config);
  });

  it('returns the original config when the source is unchanged', () => {
    const config = relatedConfig();
    expect(changeRelatedSource(config, 'account')).toBe(config);
  });

  it('clears lookup and table-specific destination selections when the source changes', () => {
    const config = relatedConfig();
    const changed = changeRelatedSource(config, 'contact');
    expect(changed).not.toBe(config);
    expect(changed.context).toMatchObject({ entityName: 'contact', lookupAttribute: '' });
    expect(changed.target).toMatchObject({ pageType: 'entityrecord', entityName: '', formId: '', tabName: '' });
    expect(changed.target.pageType === 'entityrecord' && changed.target.data).toBe('{"name":"keep"}');
  });

  it('derives one destination from the lookup and clears incompatible form and tab', () => {
    const config = relatedConfig();
    const changed = applyRelatedLookup(config, 'account', {
      LogicalName: 'primarycontactid', Targets: ['contact'],
    });
    expect(changed.context.lookupAttribute).toBe('primarycontactid');
    expect(changed.target).toMatchObject({ pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '' });
  });

  it('leaves multi-target destination table unset without choosing the first target', () => {
    const config = relatedConfig();
    const changed = applyRelatedLookup(config, 'account', {
      LogicalName: 'parentcustomerid', Targets: ['account', 'contact', 'account'],
    });
    expect(changed.context.lookupAttribute).toBe('parentcustomerid');
    expect(changed.target).toMatchObject({ pageType: 'entityrecord', entityName: '', formId: '', tabName: '' });
  });

  it('does not invent a destination when target metadata is absent', () => {
    const config = relatedConfig();
    const changed = applyRelatedLookup(config, 'account', { LogicalName: 'untypedlookup' });
    expect(changed.context.lookupAttribute).toBe('untypedlookup');
    expect(changed.target).toMatchObject({ pageType: 'entityrecord', entityName: '', formId: '', tabName: '' });
  });

  it('ignores lookup results for a source that is no longer current', () => {
    const config = relatedConfig({ context: { ...DEFAULT_CONFIG.context, mode: 'RelatedRecord', entityName: 'contact', lookupAttribute: '' } });
    expect(applyRelatedLookup(config, 'account', { LogicalName: 'primarycontactid', Targets: ['contact'] })).toBe(config);
  });
});
