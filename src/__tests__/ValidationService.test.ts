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
    const r = validate(cfg({ target: { pageType: 'entityrecord', entityName: '', entityId: '' } }));
    expect(r.isValid).toBe(false);
  });

  it('keeps missing entityName blocking even when accessible tables are provided', () => {
    const r = validate(
      cfg({ target: { pageType: 'entityrecord', entityName: '', entityId: '' } }),
      new Set(['account'])
    );
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.field === 'target.entityName')).toBe(true);
  });

  it('errors on hideHeader + canClose', () => {
    const r = validate(cfg({ pane: { hideHeader: true, canClose: true } as any }));
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.field === 'pane.hideHeader')).toBe(true);
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
      target: { pageType: 'entityrecord', entityName: 'account' } as any,
    }));
    expect(r.isValid).toBe(true); // warn-without-blocking
    expect(r.warnings.some(w => w.field === 'target.pageType')).toBe(true);
    expect(r.warnings.some(w => w.message.includes('first selected row'))).toBe(true);
  });

  it('does not warn when selected table is accessible', () => {
    const r = validate(
      cfg({ target: { pageType: 'entitylist', entityName: 'account' } }),
      new Set(['account'])
    );
    expect(r.warnings.some(w => w.field === 'target.entityName')).toBe(false);
  });

  it('warns without blocking when selected table is no longer accessible', () => {
    const r = validate(
      cfg({ target: { pageType: 'entityrecord', entityName: 'account', entityId: '' } }),
      new Set(['contact'])
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings.some(w => w.field === 'target.entityName')).toBe(true);
  });

  it('describes MainGridButton record resolution accurately', () => {
    const r = validate(cfg({
      target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
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
      target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
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
      target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
      trigger: { kind: 'FormOnLoad' } as any,
      context: { mode: 'CurrentRecord', staticRecordId: '' } as any,
    });
    expect(validate(config).errors.map(e => e.field)).not.toContain('context.staticRecordId');
  });
});
