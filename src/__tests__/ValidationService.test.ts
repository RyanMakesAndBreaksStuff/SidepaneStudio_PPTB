import { describe, it, expect } from 'vitest';
import { validate } from '../services/ValidationService';
import { DEFAULT_CONFIG, PaneDefinitionConfig } from '../types/PaneDefinitionConfig';

function cfg(overrides: Partial<PaneDefinitionConfig> = {}): PaneDefinitionConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    pane: { ...DEFAULT_CONFIG.pane, ...(overrides.pane ?? {}) },
    target: { ...DEFAULT_CONFIG.target, ...(overrides.target ?? {}) },
    trigger: { ...DEFAULT_CONFIG.trigger, ...(overrides.trigger ?? {}) },
    context: { ...DEFAULT_CONFIG.context, ...(overrides.context ?? {}) },
    behavior: { ...DEFAULT_CONFIG.behavior, ...(overrides.behavior ?? {}) },
  };
}

describe('ValidationService errors', () => {
  it('errors on empty paneId', () => {
    const r = validate(cfg({ pane: { paneId: '' } as any }));
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.field === 'pane.paneId')).toBe(true);
  });

  it('errors on custom pageType with empty name', () => {
    const r = validate(cfg({ target: { pageType: 'custom', name: '' } as any }));
    expect(r.isValid).toBe(false);
  });

  it('errors on entityrecord with empty entityName', () => {
    const r = validate(cfg({ target: { pageType: 'entityrecord', entityName: '' } as any }));
    expect(r.isValid).toBe(false);
  });

  it('keeps missing entityName blocking even when accessible tables are provided', () => {
    const r = validate(
      cfg({ target: { pageType: 'entityrecord', entityName: '' } as any }),
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
    const r = validate(cfg({ target: { pageType: 'webresource', name: 'test' } as any }));
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

  it('warns on MainGridButton + entityrecord (no single record context)', () => {
    const r = validate(cfg({
      trigger: { kind: 'MainGridButton' } as any,
      target: { pageType: 'entityrecord', entityName: 'account' } as any,
    }));
    expect(r.isValid).toBe(true); // warn-without-blocking
    expect(r.warnings.some(w => w.field === 'target.pageType')).toBe(true);
    expect(r.warnings.some(w => w.message.includes('entityId'))).toBe(true);
  });

  it('does not warn when selected table is accessible', () => {
    const r = validate(
      cfg({ target: { pageType: 'entitylist', entityName: 'account' } as any }),
      new Set(['account'])
    );
    expect(r.warnings.some(w => w.field === 'target.entityName')).toBe(false);
  });

  it('warns without blocking when selected table is no longer accessible', () => {
    const r = validate(
      cfg({ target: { pageType: 'entityrecord', entityName: 'account' } as any }),
      new Set(['contact'])
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings.some(w => w.field === 'target.entityName')).toBe(true);
  });
});
