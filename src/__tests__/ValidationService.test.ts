import { describe, expect, it } from 'vitest';
import { RESERVED_VARIABLES, validate } from '../services/ValidationService';
import { cfg } from './testHelpers';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';

const guid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const fields = (config: PaneDefinitionConfig, tables?: Set<string>) => validate(config, tables).errors.map(error => error.field);
const warned = (config: PaneDefinitionConfig, tables?: Set<string>) => validate(config, tables).warnings.map(warning => warning.field);

const record = (extra: { entityName?: string; formId?: string; data?: string; createNew?: boolean } = {}) =>
  ({ pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '', ...extra }) as const;
const contactRecord = record({ entityName: 'contact' });
const none = { source: { kind: 'none' } } as const;

describe('ValidationService errors', () => {
  it('errors on an empty pane ID', () => {
    const r = validate(cfg({ pane: { paneId: '' } }));
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.field === 'pane.paneId')).toBe(true);
  });

  it('errors on a custom page with an empty name', () => {
    const r = validate(cfg({ target: { pageType: 'custom', name: '' } }));
    expect(r.isValid).toBe(false);
    expect(r.errors.map(e => e.field)).toContain('target.name');
  });

  it('requires pane ID and custom page name together, in order', () => {
    expect(fields(cfg({ pane: { paneId: '' }, target: { pageType: 'custom', name: '' } }))).toEqual(['pane.paneId', 'target.name']);
  });

  it('errors on a fixed-record entityrecord target with an empty table', () => {
    const config = cfg({ trigger: { kind: 'ManualJS' }, target: record({ entityName: '' }), context: { source: { kind: 'fixed', entityName: '', id: guid } } });
    expect(validate(config).isValid).toBe(false);
    expect(fields(config)).toContain('target.entityName');
  });

  it('keeps a missing destination table blocking even when accessible tables are provided', () => {
    const config = cfg({ target: record({ entityName: '', createNew: true }), context: none });
    expect(fields(config, new Set(['account']))).toContain('target.entityName');
  });
});

describe('validate — hideHeader + canClose (WR-009)', () => {
  it('does not block the official hideHeader + canClose combination', () => {
    const result = validate(cfg({ pane: { hideHeader: true, canClose: true } }));
    expect(result.isValid).toBe(true);
    expect(result.errors.map(e => e.field)).not.toContain('pane.hideHeader');
  });

  it('warns that the close button will be unreachable', () => {
    const w = validate(cfg({ pane: { hideHeader: true, canClose: true } })).warnings.find(x => x.field === 'pane.hideHeader');
    expect(w).toBeDefined();
    expect(w!.message).toContain('close button');
  });

  it('emits no hideHeader warning when the header is visible', () => {
    expect(warned(cfg({ pane: { hideHeader: false, canClose: true } }))).not.toContain('pane.hideHeader');
  });
});

describe('ValidationService warnings', () => {
  it('warns on alwaysRender without blocking', () => {
    const r = validate(cfg({ pane: { alwaysRender: true } }));
    expect(r.warnings.map(w => w.field)).toContain('pane.alwaysRender');
    expect(r.isValid).toBe(true);
  });

  it('warns on FormOnLoad + isSelected false', () => {
    expect(warned(cfg({ trigger: { kind: 'FormOnLoad' }, pane: { isSelected: false } }))).toContain('pane.isSelected');
  });

  it('does not warn about isSelected false on other triggers', () => {
    expect(warned(cfg({ trigger: { kind: 'FormButton' }, pane: { isSelected: false } }))).not.toContain('pane.isSelected');
  });

  it('warns about alwaysRender and a background pane opened on form load, in order', () => {
    expect(warned(cfg({ pane: { alwaysRender: true, isSelected: false }, trigger: { kind: 'FormOnLoad' } })))
      .toEqual(['pane.alwaysRender', 'pane.isSelected']);
  });

  it('warns on a web resource target', () => {
    expect(warned(cfg({ target: { pageType: 'webresource', name: 'test' } }))).toContain('target.pageType');
  });

  it('warns that a fixed record ID is environment-specific', () => {
    const w = validate(cfg({ context: { source: { kind: 'fixed', entityName: 'account', id: guid } } })).warnings.find(x => x.field === 'context.source');
    expect(w?.message).toContain('environment-specific');
  });

  it.each(['main', 'subgrid'] as const)('warns on GridButton (%s) + selectedRow that only the first row is used', surface => {
    const w = validate(cfg({ trigger: { kind: 'GridButton', surface }, context: { source: { kind: 'selectedRow' } } }))
      .warnings.find(x => x.field === 'context.source');
    expect(w?.message).toContain('first selected row');
  });

  it('does not use the "requires a runtime row-guard" wording for the grid warning', () => {
    const w = validate(cfg({ trigger: { kind: 'GridButton', surface: 'subgrid' }, context: { source: { kind: 'selectedRow' } } }))
      .warnings.find(x => x.field === 'context.source');
    expect(w!.message).not.toContain('requires a runtime row-guard');
  });

  it('warns on GridButton + entityrecord (selectedRow) without blocking and without claiming an empty record', () => {
    const r = validate(cfg({
      trigger: { kind: 'GridButton' },
      host: { entityName: 'account' },
      target: record(),
      context: { source: { kind: 'selectedRow' } },
    }));
    expect(r.isValid).toBe(true);
    const w = r.warnings.find(x => x.field === 'context.source');
    expect(w).toBeDefined();
    expect(w!.message).toContain('first selected row');
    expect(w!.message).not.toContain('will be empty');
  });

  it('does not warn about the first row when the grid sends no record', () => {
    expect(warned(cfg({ trigger: { kind: 'GridButton' }, context: none }))).not.toContain('context.source');
  });

  it('warns when paneId contains a quote character (special-char check)', () => {
    const r = validate(cfg({ pane: { paneId: 'my"Pane' } }));
    expect(r.isValid).toBe(true);
    expect(r.warnings.map(w => w.field)).toContain('pane.paneId');
  });

  it('warns on special characters in the title without blocking', () => {
    const r = validate(cfg({ pane: { title: "It's" } }));
    expect(r.isValid).toBe(true);
    expect(r.warnings.map(w => w.field)).toContain('pane.title');
  });

  it.each([
    ['namespace', { trigger: { namespace: 'My\\Ns' } }, 'trigger.namespace'],
    ['function name', { trigger: { functionName: 'open"Pane' } }, 'trigger.functionName'],
  ] as const)('blocks the invalid %s without a misleading escape warning', (_label, overrides, field) => {
    const r = validate(cfg(overrides));
    expect(r.warnings.map(w => w.field)).not.toContain(field);
    expect(r.errors.map(e => e.field)).toEqual([field]);
  });

  it('accepts an ordinary function name and namespace without warning', () => {
    const w = warned(cfg({ trigger: { namespace: 'Contoso.Panes', functionName: 'openPane' } }));
    expect(w).not.toContain('trigger.namespace');
    expect(w).not.toContain('trigger.functionName');
  });
});

describe('validate — environment-neutral defaults (WR-010)', () => {
  it('flags the blank page name and namespace of a fresh config', () => {
    expect(validate(DEFAULT_CONFIG).errors.map(e => e.field).sort()).toEqual(['target.name', 'trigger.namespace']);
  });
});

describe('validate — trigger names (CR-001)', () => {
  it('accepts a dotted namespace', () => {
    expect(validate(cfg({ trigger: { namespace: 'Contoso.Panes' } })).errors).toEqual([]);
    expect(validate(cfg({ trigger: { namespace: 'Contoso.Sales.Panes', functionName: 'openPane' } })).errors).toEqual([]);
  });

  it.each(['Contoso Panes', '', '   ', 'class', 'Contoso.', '.Panes', 'Contoso..Panes', '1Contoso'])('blocks namespace %p', namespace => {
    expect(fields(cfg({ trigger: { namespace } }))).toEqual(['trigger.namespace']);
  });

  it('requires a namespace', () => {
    expect(validate(cfg({ trigger: { namespace: '' } })).errors).toEqual([{ field: 'trigger.namespace', message: 'Namespace is required.' }]);
  });

  it.each(['Xrm', 'Contoso.window'])('blocks namespace %p, which shadows a name the script uses', namespace => {
    expect(validate(cfg({ trigger: { namespace } })).errors)
      .toContainEqual({ field: 'trigger.namespace', message: `${namespace.split('.').pop()} is used by the generated script. Choose another namespace.` });
  });

  it('reports one namespace error when several segments are invalid', () => {
    expect(fields(cfg({ trigger: { namespace: 'a b.c d' } }))).toEqual(['trigger.namespace']);
  });

  it.each(['', 'open pane', 'for', '1open', 'pane'])('blocks function name %p', functionName => {
    expect(fields(cfg({ trigger: { functionName } }))).toEqual(['trigger.functionName']);
  });

  it('requires a function name', () => {
    expect(validate(cfg({ trigger: { functionName: '' } })).errors).toEqual([{ field: 'trigger.functionName', message: 'Function name is required.' }]);
  });

  it('checks the names for a console trigger too, because the library output defines them', () => {
    expect(fields(cfg({ trigger: { kind: 'ManualJS', namespace: 'Contoso Panes' }, context: none }))).toEqual(['trigger.namespace']);
  });
});

describe('validate — table accessibility', () => {
  const list = { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' } as const;

  it('does not warn when the selected table is accessible', () => {
    expect(warned(cfg({ target: list, context: none }), new Set(['account']))).not.toContain('target.entityName');
  });

  it('warns without blocking when the selected table is not in the current table list', () => {
    const r = validate(
      cfg({ trigger: { kind: 'ManualJS' }, target: record(), context: { source: { kind: 'fixed', entityName: '', id: guid } } }),
      new Set(['contact']),
    );
    expect(r.isValid).toBe(true);
    expect(r.warnings).toContainEqual({
      field: 'target.entityName',
      message: 'Table "account" is not in the current table list for this environment.',
    });
  });

  it('warns for an inaccessible entity list table too', () => {
    expect(warned(cfg({ target: list, context: none }), new Set(['contact']))).toContain('target.entityName');
  });

  it('skips the check when no accessible set is provided', () => {
    expect(warned(cfg({ target: list, context: none }))).not.toContain('target.entityName');
  });
});

describe('validate — dashboard target', () => {
  it('errors when the dashboard ID is empty', () => {
    const r = validate(cfg({ target: { pageType: 'dashboard', dashboardId: '', dashboardName: '' }, context: none }));
    expect(r.isValid).toBe(false);
    expect(r.errors.some(e => e.field === 'target.dashboardId')).toBe(true);
  });

  it('errors when the dashboard ID is only whitespace', () => {
    expect(fields(cfg({ target: { pageType: 'dashboard', dashboardId: '  ', dashboardName: '' }, context: none }))).toContain('target.dashboardId');
  });

  // The validator only requires a non-empty dashboard ID; it does not GUID-check it (HEAD behaviour, unchanged).
  it('accepts a non-empty dashboard ID', () => {
    const r = validate(cfg({ target: { pageType: 'dashboard', dashboardId: 'aaa-bbb-ccc', dashboardName: 'Sales' }, context: none }));
    expect(r.errors).toEqual([]);
  });
});

describe('static record ID validation', () => {
  const manual = (id: string) => cfg({
    trigger: { kind: 'ManualJS' },
    target: record(),
    context: { source: { kind: 'fixed', entityName: '', id } },
  });

  it('blocks an entityrecord + ManualJS fixed source with no record ID', () => {
    const result = validate(manual(''));
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('context.source.id');
  });

  it('blocks a fixed source with a malformed record ID', () => {
    const result = validate(manual('not-a-guid'));
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('context.source.id');
  });

  it('accepts a well-formed record ID', () => {
    expect(fields(manual(guid))).not.toContain('context.source.id');
  });

  it('accepts a braced, upper-case GUID', () => {
    expect(fields(manual(`{${guid.toUpperCase()}}`))).not.toContain('context.source.id');
  });

  it('does not ask for a record ID when the trigger supplies the record at runtime', () => {
    const config = cfg({ trigger: { kind: 'FormOnLoad' }, target: record(), context: { source: { kind: 'host' } } });
    expect(fields(config)).not.toContain('context.source.id');
    expect(validate(config).errors).toEqual([]);
  });
});

describe('validate — pane width', () => {
  it.each([299, 1201, Number.NaN, Number.POSITIVE_INFINITY, '480;globalThis.pwned=1'])('rejects invalid pane width %p', width => {
    expect(fields(cfg({ pane: { width: width as number } }))).toContain('pane.width');
  });

  it.each([300, 1200])('accepts boundary pane width %p', width => {
    expect(fields(cfg({ pane: { width } }))).not.toContain('pane.width');
  });
});

describe('validate — LookupTagClick', () => {
  const tag = (lookupControls: string[]) =>
    cfg({ trigger: { kind: 'LookupTagClick' }, host: { entityName: 'account', lookupControls }, context: { source: { kind: 'clickedTag' } } });

  it('accepts several lookup controls', () => {
    expect(fields(tag(['parentcustomerid', 'primarycontactid']))).not.toContain('host.lookupControls');
  });

  it('blocks a list entry that is not a logical name', () => {
    expect(validate(tag(['parentcustomerid', 'bad name'])).errors)
      .toContainEqual({ field: 'host.lookupControls', message: 'Lookup control names must be logical names.' });
  });

  it('requires at least one lookup control', () => {
    expect(validate(tag([])).errors)
      .toContainEqual({ field: 'host.lookupControls', message: 'Select at least one lookup control.' });
  });

  it('requires the host table', () => {
    const config = cfg({ trigger: { kind: 'LookupTagClick' }, host: { entityName: '', lookupControls: ['parentaccountid'] }, context: { source: { kind: 'clickedTag' } } });
    expect(fields(config)).toEqual(['host.entityName']);
  });

  it('needs no configured record ID because the clicked tag supplies it', () => {
    const config = cfg({
      trigger: { kind: 'LookupTagClick' },
      host: { entityName: 'account', lookupControls: ['parentaccountid'] },
      target: record({ entityName: '' }),
      context: { source: { kind: 'clickedTag' } },
    });
    expect(validate(config).errors).toEqual([]);
  });
});

describe('validate — web resource name (WR-003)', () => {
  it('blocks an empty web resource name', () => {
    const result = validate(cfg({ target: { pageType: 'webresource', name: '' } }));
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('target.name');
  });

  it('blocks a whitespace-only web resource name', () => {
    expect(validate(cfg({ target: { pageType: 'webresource', name: '   ' } })).isValid).toBe(false);
  });

  it('accepts a populated web resource name', () => {
    expect(fields(cfg({ target: { pageType: 'webresource', name: 'new_mypage.html' } }))).not.toContain('target.name');
  });
});

describe('validate — search page type (WR-001)', () => {
  const search = (searchText: string) => cfg({ target: { pageType: 'search', searchText }, context: none });

  it('warns that search is not a documented navigateTo pageType', () => {
    const w = validate(search('Contoso')).warnings.find(x => x.field === 'target.pageType');
    expect(w).toBeDefined();
    expect(w!.message).toContain('not a documented');
  });

  it('keeps search advisory, not blocking, even with empty search text', () => {
    expect(validate(search('Contoso')).isValid).toBe(true);
    expect(validate(search('')).errors).toEqual([]);
  });

  it('emits no search warning for a custom page', () => {
    expect(warned(cfg({ target: { pageType: 'custom', name: 'sps_Page' } }))).not.toContain('target.pageType');
  });
});

describe('validate — entity list view', () => {
  const list = (over: { entityName?: string; viewId?: string; viewType?: '' | 'savedquery' | 'userquery' }) =>
    cfg({ target: { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '', ...over }, context: none });

  it('requires a table, a valid view GUID and a view type together', () => {
    expect(fields(list({ entityName: '', viewId: 'bad' }))).toEqual(['target.entityName', 'target.viewId', 'target.viewType']);
  });

  it('accepts a table without a view', () => {
    expect(validate(list({})).errors).toEqual([]);
  });

  it('accepts a valid view GUID with a view type', () => {
    expect(validate(list({ viewId: guid, viewType: 'savedquery' })).errors).toEqual([]);
  });

  it('requires a view type when a view GUID is set', () => {
    expect(fields(list({ viewId: guid }))).toEqual(['target.viewType']);
  });
});

describe('validate — entity record form', () => {
  it('rejects a malformed form ID and non-object form data', () => {
    const config = cfg({ target: record({ formId: 'bad', data: '[1]' }) });
    expect(fields(config)).toEqual(['target.formId', 'target.data']);
  });

  it('accepts a form GUID and a JSON object', () => {
    expect(validate(cfg({ target: record({ formId: guid, data: '{"a":1}' }) })).errors).toEqual([]);
  });

  it('rejects unparsable form data', () => {
    expect(validate(cfg({ target: record({ data: '{nope' }) })).errors)
      .toContainEqual({ field: 'target.data', message: 'Form data must be a JSON object.' });
  });
});

describe('validate — record source follows the capability table', () => {
  it('blocks selectedRow on a trigger that has no grid', () => {
    const result = validate(cfg({ trigger: { kind: 'FormButton' }, context: { source: { kind: 'selectedRow' } } }));
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('context.source');
  });

  it.each(['main', 'subgrid'] as const)('allows selectedRow on a GridButton (%s)', surface => {
    expect(fields(cfg({ trigger: { kind: 'GridButton', surface }, context: { source: { kind: 'selectedRow' } } }))).not.toContain('context.source');
  });

  it('allows selectedRow on GridRowSelect', () => {
    expect(fields(cfg({ trigger: { kind: 'GridRowSelect', surface: 'subgrid' }, context: { source: { kind: 'selectedRow' } } }))).toEqual([]);
  });

  it('blocks the host record on ManualJS, which has no ambient record', () => {
    const result = validate(cfg({ trigger: { kind: 'ManualJS' }, context: { source: { kind: 'host' } } }));
    expect(result.isValid).toBe(false);
    expect(result.errors.map(e => e.field)).toContain('context.source');
  });

  it('allows no record on ManualJS', () => {
    expect(fields(cfg({ trigger: { kind: 'ManualJS' }, context: none }))).not.toContain('context.source');
  });

  it('blocks a clicked tag on a non-lookup trigger', () => {
    expect(fields(cfg({ trigger: { kind: 'FormButton' }, context: { source: { kind: 'clickedTag' } } }))).toContain('context.source');
  });

  it('blocks a content type the trigger cannot open (entity list from a grid)', () => {
    const list = { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' } as const;
    for (const kind of ['GridButton', 'GridRowSelect'] as const) {
      expect(fields(cfg({ trigger: { kind }, target: list, context: none }))).toContain('target.pageType');
    }
  });

  it('blocks a record source for a content type that takes no record', () => {
    const dashboard = { pageType: 'dashboard', dashboardId: guid, dashboardName: 'Dash' } as const;
    const search = { pageType: 'search', searchText: '' } as const;
    const list = { pageType: 'entitylist', entityName: 'contact', viewId: '', viewType: '' } as const;
    for (const target of [list, dashboard, search]) {
      expect(fields(cfg({ trigger: { kind: 'FormButton' }, target, context: { source: { kind: 'host' } } }))).toContain('context.source');
    }
  });

  it('an existing-record target must have a record source (none is illegal)', () => {
    expect(fields(cfg({ target: record(), context: none }))).toContain('context.source');
  });
});

describe('validate — lookup source (related record)', () => {
  const lookup = { source: { kind: 'lookup', attribute: 'primarycontactid' } } as const;

  it.each([
    ['FormOnLoad', 'main'], ['FormButton', 'main'], ['FormOnChange', 'main'],
    ['GridButton', 'main'], ['GridButton', 'subgrid'], ['GridRowSelect', 'main'], ['GridRowSelect', 'subgrid'],
  ] as const)('accepts %s (%s) with a host table and lookup column', (kind, surface) => {
    const host = { entityName: 'account', attribute: kind === 'FormOnChange' ? 'name' : '' };
    const result = validate(cfg({ trigger: { kind, surface }, host, context: lookup, target: contactRecord }));
    expect(result.errors).toEqual([]);
  });

  it('allows an empty destination table for an existing-record target', () => {
    const result = validate(cfg({ trigger: { kind: 'FormButton' }, host: { entityName: 'account' }, context: lookup, target: record({ entityName: '' }) }));
    expect(result.errors).toEqual([]);
  });

  it('still requires a destination table when the record source is fixed', () => {
    const config = cfg({
      trigger: { kind: 'ManualJS' },
      target: record({ entityName: '' }),
      context: { source: { kind: 'fixed', entityName: '', id: guid } },
    });
    expect(fields(config)).toContain('target.entityName');
  });

  it('blocks lookup in create mode and still requires the destination table', () => {
    const config = cfg({
      trigger: { kind: 'FormButton' },
      host: { entityName: 'account' },
      context: lookup,
      target: record({ entityName: '', createNew: true }),
    });
    expect(fields(config)).toContain('target.entityName');
    expect(fields(config)).toContain('context.source');
  });

  it.each(['ManualJS', 'LookupTagClick'] as const)('blocks lookup on %s, which has no host record', kind => {
    const config = cfg({
      trigger: { kind },
      host: { entityName: 'account', lookupControls: ['parentaccountid'] },
      context: lookup,
      target: { pageType: 'custom', name: 'sps_Page' },
    });
    expect(fields(config)).toContain('context.source');
  });

  it('requires a host table and a valid lookup column', () => {
    const config = cfg({ trigger: { kind: 'GridRowSelect' }, host: { entityName: '' }, target: contactRecord, context: { source: { kind: 'lookup', attribute: "primarycontactid'" } } });
    expect(fields(config)).toEqual(['host.entityName', 'context.source.attribute']);
  });

  it('requires the lookup column on a form trigger too', () => {
    const config = cfg({ trigger: { kind: 'FormButton' }, host: { entityName: 'account' }, target: contactRecord, context: { source: { kind: 'lookup', attribute: '' } } });
    expect(fields(config)).toEqual(['context.source.attribute']);
  });

  it('allows a lookup source for a generative page', () => {
    const config = cfg({
      trigger: { kind: 'GridRowSelect' },
      host: { entityName: 'account' },
      target: { pageType: 'generative', pageId: guid, data: '' },
      context: lookup,
    });
    expect(validate(config).errors).toEqual([]);
  });
});

describe('validate — host requirements', () => {
  it('needs no host table for a form button using the host record', () => {
    expect(validate(cfg({ trigger: { kind: 'FormButton' }, host: { entityName: '' }, context: { source: { kind: 'host' } } })).errors).toEqual([]);
  });

  it('requires the table and column for FormOnChange', () => {
    expect(fields(cfg({ trigger: { kind: 'FormOnChange' }, host: { entityName: '', attribute: '' } }))).toEqual(['host.entityName', 'host.attribute']);
  });

  it('rejects a FormOnChange column that is not a logical name', () => {
    expect(fields(cfg({ trigger: { kind: 'FormOnChange' }, host: { entityName: 'account', attribute: 'bad name' } }))).toEqual(['host.attribute']);
  });

  it('needs no destination table when the opened record comes from the host or a clicked tag', () => {
    const open = record({ entityName: '' });
    expect(validate(cfg({ trigger: { kind: 'FormButton' }, target: open, context: { source: { kind: 'host' } } })).errors).toEqual([]);
    expect(validate(cfg({
      trigger: { kind: 'LookupTagClick' }, host: { entityName: 'account', lookupControls: ['parentaccountid'] },
      target: open, context: { source: { kind: 'clickedTag' } },
    })).errors).toEqual([]);
  });
});

describe('validate — record variable name', () => {
  const named = (variableName: string) => cfg({ host: { entityName: 'account' }, context: { source: { kind: 'host' }, variableName } });

  it.each(['1x', 'for', 'class', '', 'bad name'])('rejects invalid identifier %p', variableName => {
    expect(fields(named(variableName))).toContain('context.variableName');
  });

  it('rejects every name the generated scripts use', () => {
    expect(RESERVED_VARIABLES.length).toBeGreaterThan(0);
    for (const variableName of RESERVED_VARIABLES) {
      expect(validate(named(variableName)).errors, variableName).toContainEqual(expect.objectContaining({ field: 'context.variableName' }));
    }
  });

  it('accepts a valid, unreserved name', () => {
    expect(fields(named('accountId'))).not.toContain('context.variableName');
  });

  it('does not check the name when no record is sent', () => {
    expect(fields(cfg({ context: { source: { kind: 'none' }, variableName: 'for' } }))).not.toContain('context.variableName');
    expect(fields(cfg({ target: record({ createNew: true }), context: { source: { kind: 'none' }, variableName: 'for' } }))).not.toContain('context.variableName');
  });
});

describe('validate — entity record create mode', () => {
  const create = (trigger: Partial<PaneDefinitionConfig['trigger']>, source: PaneDefinitionConfig['context']['source'], entityName = 'contact') =>
    cfg({ trigger, host: { entityName: 'account' }, context: { source }, target: record({ entityName, createNew: true }) });

  it('needs no record ID', () => {
    expect(validate(create({ kind: 'FormButton' }, { kind: 'none' })).errors).toEqual([]);
  });

  it('requires the destination table', () => {
    expect(fields(create({ kind: 'FormButton' }, { kind: 'none' }, ''))).toEqual(['target.entityName']);
  });

  it('blocks a clicked lookup tag, which names a record to open', () => {
    const config = cfg({
      trigger: { kind: 'LookupTagClick' },
      host: { entityName: 'account', lookupControls: ['parentcustomerid'] },
      target: record({ createNew: true }),
      context: { source: { kind: 'clickedTag' } },
    });
    expect(fields(config)).toContain('context.source');
  });

  it('blocks lookup and fixed sources, which name a record to open', () => {
    expect(fields(create({ kind: 'FormButton' }, { kind: 'lookup', attribute: 'primarycontactid' }))).toContain('context.source');
    expect(fields(create({ kind: 'ManualJS' }, { kind: 'fixed', entityName: '', id: guid }))).toContain('context.source');
  });

  it('pre-fills from the host and explains the relationship mapping', () => {
    const result = validate(create({ kind: 'FormButton' }, { kind: 'host' }));
    expect(result.errors).toEqual([]);
    expect(result.warnings.find(w => w.field === 'target.createNew')?.message).toContain('relationship mapping');
  });

  it('pre-fills from a grid row and explains the relationship mapping', () => {
    const config = create({ kind: 'GridButton' }, { kind: 'selectedRow' });
    expect(validate(config).errors).toEqual([]);
    expect(warned(config)).toEqual(expect.arrayContaining(['target.createNew', 'context.source']));
  });

  it('does not warn about mapping for a blank new record', () => {
    expect(warned(create({ kind: 'FormButton' }, { kind: 'none' }))).not.toContain('target.createNew');
  });
});

describe('validate — generative page', () => {
  const target = { pageType: 'generative', pageId: guid, data: '' } as const;
  const page = (over: { pageId?: string; data?: string } = {}, source: PaneDefinitionConfig['context']['source'] = { kind: 'none' }) =>
    cfg({ target: { ...target, ...over }, context: { source } });

  it('accepts a page ID with no inputs and does not warn about inputs', () => {
    const result = validate(page());
    expect(result.errors).toEqual([]);
    expect(result.warnings.map(w => w.field)).not.toContain('target.pageType');
  });

  it.each(['', 'not-a-guid'])('blocks page ID %p', pageId => {
    expect(validate(page({ pageId })).errors).toContainEqual({ field: 'target.pageId', message: 'Page ID must be the GUID of a generative page.' });
  });

  it('blocks page data that is not a JSON object', () => {
    expect(validate(page({ data: '[1]' })).errors).toContainEqual({ field: 'target.data', message: 'Page data must be a JSON object.' });
  });

  it('blocks a fixed record without its table', () => {
    expect(fields(page({}, { kind: 'fixed', id: guid, entityName: '' }))).toContain('context.source.entityName');
  });

  it('blocks a fixed record without a valid ID', () => {
    expect(fields(page({}, { kind: 'fixed', id: '', entityName: 'account' }))).toContain('context.source.id');
  });

  it('warns that inputs reach the page only when it accepts them', () => {
    expect(warned(page({ data: '{"a":1}' }))).toContain('target.pageType');
    expect(warned(page({}, { kind: 'host' }))).toContain('target.pageType');
  });
});

describe('validate — close if already open', () => {
  it.each(['FormOnLoad', 'FormOnChange', 'GridRowSelect', 'LookupTagClick', 'ManualJS'] as const)('blocks %s, which would close its own pane', kind => {
    const result = validate(cfg({ trigger: { kind }, context: none, behavior: { toggleIfOpen: true } }));
    expect(result.errors.map(e => e.field)).toContain('behavior.toggleIfOpen');
  });

  it.each(['FormButton', 'GridButton'] as const)('allows %s', kind => {
    const result = validate(cfg({ trigger: { kind }, context: none, behavior: { toggleIfOpen: true } }));
    expect(result.errors.map(e => e.field)).not.toContain('behavior.toggleIfOpen');
  });

  it('warns when the pane has no close button', () => {
    const result = validate(cfg({ pane: { canClose: false }, behavior: { toggleIfOpen: true } }));
    expect(result.isValid).toBe(true);
    expect(result.warnings.map(w => w.field)).toContain('behavior.toggleIfOpen');
  });

  it('warns when a hidden header removes the close button', () => {
    expect(warned(cfg({ pane: { hideHeader: true, canClose: true }, behavior: { toggleIfOpen: true } }))).toContain('behavior.toggleIfOpen');
  });

  it('does not warn when the pane can be closed', () => {
    expect(warned(cfg({ behavior: { toggleIfOpen: true } }))).not.toContain('behavior.toggleIfOpen');
  });
});

describe('validate — behavior flags', () => {
  it.each([true, false])('never blocks on reuseExistingPane=%p', reuseExistingPane => {
    expect(validate(cfg({ behavior: { reuseExistingPane } })).errors).toEqual([]);
  });

  it('never blocks on expandOnOpen or closeOthers', () => {
    expect(validate(cfg({ behavior: { expandOnOpen: false, closeOthers: true } })).errors).toEqual([]);
  });
});

describe('validate — ordered multi-issue groups', () => {
  it('lists every generative-page issue in order', () => {
    const result = validate(cfg({
      target: { pageType: 'generative', pageId: 'not-a-guid', data: '[1]' },
      context: { source: { kind: 'fixed', id: guid, entityName: '' } },
    }));
    expect(result).toEqual({
      isValid: false,
      errors: [
        { field: 'context.source.entityName', message: "Select the record's table." },
        { field: 'target.pageId', message: 'Page ID must be the GUID of a generative page.' },
        { field: 'target.data', message: 'Page data must be a JSON object.' },
      ],
      warnings: [
        { field: 'context.source', message: 'A fixed record ID is environment-specific. Reconfigure it after deploying to another environment.' },
        { field: 'target.pageType', message: 'recordId, entityName and data reach the page only if its prompt sets it up to accept input parameters.' },
      ],
    });
  });

  it('lists every entity-record issue in order', () => {
    const result = validate(cfg({
      trigger: { kind: 'GridButton' },
      host: { entityName: '' },
      context: { source: { kind: 'lookup', attribute: '' } },
      target: record({ entityName: 'contact', formId: 'not-a-guid', data: '[1]', createNew: true }),
    }));
    expect(result.errors).toEqual([
      { field: 'context.source', message: 'This record choice is not available for the selected trigger and content. Choose another record.' },
      { field: 'host.entityName', message: 'Select the table that holds the lookup column.' },
      { field: 'context.source.attribute', message: 'Select the lookup column whose record opens in the pane.' },
      { field: 'target.formId', message: 'Form ID must be a valid GUID.' },
      { field: 'target.data', message: 'Form data must be a JSON object.' },
    ]);
    expect(result.isValid).toBe(false);
  });
});

describe('validate — pane.imageSrc the generator drops (W11)', () => {
  it.each(['https://evil.test/x.svg', '/sps_/icons/x.svg', '../x.svg', 'javascript:alert(1)'])(
    'warns that %p is not emitted', imageSrc => {
      const result = validate(cfg({ pane: { imageSrc } }));
      expect(result.warnings).toContainEqual({ field: 'pane.imageSrc', message: 'Not emitted: path must be relative to WebResources.' });
      expect(result.errors.map(e => e.field)).not.toContain('pane.imageSrc');
    });

  it.each(['', '   ', 'sps_/icons/pane.svg', 'WebResources/sps_/icons/pane.svg'])('does not warn for %p', imageSrc => {
    expect(warned(cfg({ pane: { imageSrc } }))).not.toContain('pane.imageSrc');
  });
});

describe('validate — selections restored from another environment (W20)', () => {
  const formRecord = cfg({ target: record({ formId: guid }) });
  const view = cfg({ trigger: { kind: 'ManualJS' }, target: { pageType: 'entitylist', entityName: 'account', viewId: guid, viewType: 'savedquery' }, context: none });
  const page = cfg({ trigger: { kind: 'ManualJS' }, target: { pageType: 'generative', pageId: guid, data: '' }, context: none });

  it.each([
    ['entityrecord', formRecord, ['target.entityName', 'target.formId']],
    ['entitylist', view, ['target.entityName', 'target.viewId']],
    ['generative', page, ['target.pageId']],
  ] as const)('warns, without blocking, on every set %s selection', (_label, config, expected) => {
    const result = validate(config, undefined, true);
    const flagged = result.warnings.filter(w => w.message.includes('different environment')).map(w => w.field);
    expect(flagged).toEqual(expected);
    expect(result.errors).toEqual(validate(config).errors);
  });

  it('flags nothing that is unset', () => {
    const result = validate(cfg({ target: record({ entityName: '', formId: '' }) }), undefined, true);
    expect(result.warnings.filter(w => w.message.includes('different environment'))).toEqual([]);
  });

  it('flags nothing when the config was saved for this environment', () => {
    expect(validate(formRecord).warnings.filter(w => w.message.includes('different environment'))).toEqual([]);
  });
});
