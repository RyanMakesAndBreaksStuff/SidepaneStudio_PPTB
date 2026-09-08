import { describe, it, expect } from 'vitest';
import { validate } from '../services/ValidationService';
import { cfg } from './testHelpers';

describe('ValidationService errors', () => {
  it('errors on empty paneId', () => {
    const r = validate(cfg({ pane: { paneId: '' } as any }));
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.field === 'pane.paneId')).toBe(true);
  });

  it('errors on custom pageType with empty name', () => {
    const r = validate(cfg({ target: { pageType: 'custom', name: '' } }));
    expect(r.isValid).toBe(false);
  });

  it('errors on entityrecord with empty entityName', () => {
    const r = validate(cfg({ target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '' } }));
    expect(r.isValid).toBe(false);
  });

  it('keeps missing entityName blocking even when accessible tables are provided', () => {
    const r = validate(
      cfg({ target: { pageType: 'entityrecord', entityName: '', formId: '', tabName: '', data: '' } }),
      new Set(['account'])
    );
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.field === 'target.entityName')).toBe(true);
  });
});

describe('validate — hideHeader + canClose (WR-009)', () => {
  it('does not block the official hideHeader + canClose combination', () => {
    const result = validate(cfg({ pane: { hideHeader: true, canClose: true } as any }));
    expect(result.isValid).toBe(true);
    expect(result.errors.map(e => e.field)).not.toContain('pane.hideHeader');
  });

  it('warns that the close button will be unreachable', () => {
    const result = validate(cfg({ pane: { hideHeader: true, canClose: true } as any }));
    const w = result.warnings.find(x => x.field === 'pane.hideHeader');
    expect(w).toBeDefined();
    expect(w!.message).toContain('close');
  });

  it('emits no hideHeader warning when the header is visible', () => {
    const result = validate(cfg({ pane: { hideHeader: false, canClose: true } as any }));
    expect(result.warnings.map(w => w.field)).not.toContain('pane.hideHeader');
  });
});

describe('ValidationService warnings', () => {
  it('warns on alwaysRender', () => {
    const r = validate(cfg({ pane: { alwaysRender: true } as any }));
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.isValid).toBe(true);
  });

  it('warns on FormOnLoad + isSelected false', () => {
    const r = validate(cfg({ trigger: { kind: 'FormOnLoad' } as any, pane: { isSelected: false } as any }));
    expect(r.warnings.some(w => w.field === 'pane.isSelected')).toBe(true);
  });

  it('warns on webresource pageType', () => {
    const r = validate(cfg({ target: { pageType: 'webresource', name: 'test' } }));
    expect(r.warnings.some(w => w.field === 'target.pageType')).toBe(true);
  });

  it('warns on Static context mode', () => {
    const r = validate(cfg({ context: { mode: 'Static' } as any }));
    expect(r.warnings.some(w => w.field === 'context.mode')).toBe(true);
  });

  it('warns on SubgridButton + SelectedRow', () => {
    const r = validate(cfg({ trigger: { kind: 'SubgridButton' } as any, context: { mode: 'SelectedRow' } as any }));
    expect(r.warnings.some(w => w.field === 'context.mode')).toBe(true);
  });

  it('warns when paneId contains a double-quote character (P2-11 special-char check)', () => {
    const r = validate(cfg({ pane: { paneId: 'my"Pane' } as any }));
    expect(r.isValid).toBe(true);
    expect(r.warnings.some(w => w.field === 'pane.paneId')).toBe(true);
  });

  it('errors when dashboard pageType has empty dashboardId', () => {
    const config = cfg({ target: { pageType: 'dashboard', dashboardId: '', dashboardName: '' } });
    const result = validate(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'target.dashboardId')).toBe(true);
  });

  it('is valid when dashboard pageType has a non-empty dashboardId', () => {
    const config = cfg({
      target: { pageType: 'dashboard', dashboardId: 'aaa-bbb-ccc', dashboardName: 'Sales' },
    });
    const result = validate(config);
    const dashboardErrors = result.errors.filter(e => e.field === 'target.dashboardId');
    expect(dashboardErrors).toHaveLength(0);
  });

  it('is valid when search pageType has empty searchText', () => {
    const config = cfg({ target: { pageType: 'search', searchText: '' } });
    const result = validate(config);
    const searchErrors = result.errors.filter(e => e.field.startsWith('target'));
    expect(searchErrors).toHaveLength(0);
  });

  it('warns on MainGridButton + entityrecord (no single record context)', () => {
    const r = validate(cfg({
      trigger: { kind: 'MainGridButton' } as any,
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } as any,
    }));
    expect(r.isValid).toBe(true); // warn-without-blocking
    expect(r.warnings.some(w => w.field === 'target.pageType')).toBe(true);
    expect(r.warnings.some(w => w.message.includes('first selected row'))).toBe(true);
  });

  it('does not warn when selected table is accessible', () => {
    const r = validate(
      cfg({ target: { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' } }),
      new Set(['account'])
    );
    expect(r.warnings.some(w => w.field === 'target.entityName')).toBe(false);
  });

  it('warns without blocking when selected table is no longer accessible', () => {
    const r = validate(
      cfg({ target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' } }),
      new Set(['contact'])
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings.some(w => w.field === 'target.entityName')).toBe(true);
  });

  it('describes MainGridButton record resolution accurately', () => {
    const r = validate(cfg({
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      trigger: { kind: 'MainGridButton' } as any,
    }));
    const warning = r.warnings.find(w => w.field === 'target.pageType');
    expect(warning).toBeDefined();
    expect(warning!.message).not.toContain('will be empty');
    expect(warning!.message).toContain('first selected row');
  });
});

describe('static record ID validation', () => {
  const entityRecordManual = (staticRecordId: string, mode: 'Static' | 'CurrentRecord') =>
    cfg({
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      trigger: { kind: 'ManualJS' } as any,
      context: { mode, staticRecordId } as any,
    });

  it('blocks an entityrecord + ManualJS config with no record ID', () => {
    const result = validate(entityRecordManual('', 'CurrentRecord'));
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('context.staticRecordId');
  });

  it('blocks an entityrecord + Static config with a malformed record ID', () => {
    const result = validate(entityRecordManual('not-a-guid', 'Static'));
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('context.staticRecordId');
  });

  it('accepts a well-formed record ID', () => {
    const result = validate(entityRecordManual('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'Static'));
    expect(result.errors.map(e => e.field)).not.toContain('context.staticRecordId');
  });

  it('does not fire when the trigger supplies the record at runtime', () => {
    const config = cfg({
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      trigger: { kind: 'FormOnLoad' } as any,
      context: { mode: 'CurrentRecord', staticRecordId: '' } as any,
    });
    expect(validate(config).errors.map(e => e.field)).not.toContain('context.staticRecordId');
  });
});

describe('validate — web resource name (WR-003)', () => {
  it('blocks an empty web resource name the same way it blocks an empty custom page name', () => {
    const result = validate(cfg({ target: { pageType: 'webresource', name: '' } }));
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('target.name');
  });

  it('blocks a whitespace-only web resource name', () => {
    const result = validate(cfg({ target: { pageType: 'webresource', name: '   ' } }));
    expect(result.isValid).toBe(false);
  });

  it('accepts a populated web resource name', () => {
    const result = validate(cfg({ target: { pageType: 'webresource', name: 'new_mypage.html' } }));
    expect(result.errors.map(e => e.field)).not.toContain('target.name');
  });
});

describe('validate — search page type (WR-001)', () => {
  it('warns that search is not a documented navigateTo pageType', () => {
    const result = validate(cfg({ target: { pageType: 'search', searchText: 'Contoso' } }));
    const w = result.warnings.find(x => x.field === 'target.pageType');
    expect(w).toBeDefined();
    expect(w!.message).toContain('not a documented');
  });

  it('keeps search advisory, not blocking', () => {
    const result = validate(cfg({ target: { pageType: 'search', searchText: 'Contoso' } }));
    expect(result.isValid).toBe(true);
  });

  it('emits no search warning for a custom page', () => {
    const result = validate(cfg({ target: { pageType: 'custom', name: 'sps_Page' } }));
    expect(result.warnings.map(w => w.field)).not.toContain('target.pageType');
  });
});

describe('validate — record context (CR-001 companion)', () => {
  it('blocks SelectedRow on a trigger that has no grid', () => {
    const result = validate(
      cfg({
        trigger: { kind: 'FormButton', functionName: 'openPane', namespace: 'Ns', fieldName: '' },
        context: { mode: 'SelectedRow', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('context.mode');
  });

  it('allows SelectedRow on a SubgridButton trigger', () => {
    const result = validate(
      cfg({
        trigger: { kind: 'SubgridButton', functionName: 'openPane', namespace: 'Ns', fieldName: '' },
        context: { mode: 'SelectedRow', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(result.errors.map(e => e.field)).not.toContain('context.mode');
  });

  it('blocks CurrentRecord on ManualJS, which has no ambient record', () => {
    const result = validate(
      cfg({
        trigger: { kind: 'ManualJS', functionName: 'openPane', namespace: 'Ns', fieldName: '' },
        context: { mode: 'CurrentRecord', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('context.mode');
  });

  it('allows None on ManualJS', () => {
    const result = validate(
      cfg({
        trigger: { kind: 'ManualJS', functionName: 'openPane', namespace: 'Ns', fieldName: '' },
        context: { mode: 'None', entityName: '', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(result.errors.map(e => e.field)).not.toContain('context.mode');
  });
});

describe('validate — subgrid row-guard warning (IN-001)', () => {
  it('describes the actual runtime behavior instead of demanding a guard', () => {
    const result = validate(
      cfg({
        trigger: { kind: 'SubgridButton', functionName: 'openPane', namespace: 'Ns', fieldName: '' },
        context: { mode: 'SelectedRow', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
      })
    );
    const w = result.warnings.find(x => x.field === 'context.mode');
    expect(w).toBeDefined();
    expect(w!.message).not.toContain('requires a runtime row-guard');
    expect(w!.message).toContain('first selected row');
  });
});
