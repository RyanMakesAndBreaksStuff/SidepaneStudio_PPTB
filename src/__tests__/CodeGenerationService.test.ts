import { describe, it, expect } from 'vitest';
import { generateBasicScript, generateLibraryScript } from '../services/CodeGenerationService';
import { cfg } from './testHelpers';

function isValidJS(code: string): boolean {
  try {
    new Function(code);
    return true;
  } catch {
    return false;
  }
}

describe('generateBasicScript — syntax validity', () => {
  for (const kind of ['FormOnLoad', 'FormButton', 'MainGridButton', 'SubgridButton', 'ManualJS', 'FormOnChange'] as const) {
    it(`${kind} produces valid JS`, () => {
      const config = cfg({ trigger: { kind, fieldName: kind === 'FormOnChange' ? 'new_field' : '' } as any });
      const code = generateBasicScript(config);
      expect(code.length).toBeGreaterThan(0);
      expect(isValidJS(code)).toBe(true);
    });
  }
});

describe('generateBasicScript — state = 1 rules', () => {
  it('FormOnLoad NEVER emits state = 1', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnLoad' } as any, behavior: { expandOnOpen: true } as any })
    );
    expect(code).not.toContain('state = 1');
  });

  it('FormButton with expandOnOpen emits state = 1', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        behavior: { expandOnOpen: true } as any,
        pane: { isSelected: true } as any,
      })
    );
    expect(code).toContain('state = 1');
  });

  it('FormButton with expandOnOpen: false omits state = 1', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormButton' } as any, behavior: { expandOnOpen: false } as any })
    );
    expect(code).not.toContain('state = 1');
  });

  it('FormButton with isSelected: false omits state = 1', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        pane: { isSelected: false } as any,
        behavior: { expandOnOpen: true } as any,
      })
    );
    expect(code).not.toContain('state = 1');
  });
});

describe('generateBasicScript — pending cache', () => {
  it('FormButton includes namespaced pending cache', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'FormButton' } as any }));
    expect(code).toContain('window.__spstudio_pendingPanes');
    expect(code).not.toContain('window._pendingPanes');
  });

  it('ManualJS has no pending cache', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'ManualJS' } as any }));
    expect(code).not.toContain('_pendingPanes');
  });

  it('ManualJS is a named async IIFE', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'ManualJS', functionName: 'myFunc' } as any }));
    expect(code).toContain('async function myFunc');
    expect(code).toContain('.catch(');
  });
});

describe('generateBasicScript — safe generated identifiers', () => {
  it('falls back for malicious namespace and function names', () => {
    const code = generateBasicScript(
      cfg({
        trigger: {
          kind: 'FormButton',
          namespace: 'Bad;window.hacked=1//',
          functionName: 'open);window.hacked=1;//',
          fieldName: '',
        },
      })
    );

    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('var MyNamespace = MyNamespace || {};');
    expect(code).toContain('MyNamespace.openPane = function');
    expect(code).not.toContain('Bad;window.hacked=1//');
    expect(code).not.toContain('open);window.hacked=1;//');
  });
});

describe('generateBasicScript — reuseExistingPane', () => {
  it('reuseExistingPane: true emits select(); return;', () => {
    const code = generateBasicScript(cfg({ context: { reuseExistingPane: true } as any }));
    expect(code).toContain('.select()');
  });

  it('reuseExistingPane: false proceeds to createPane (no early return on existing)', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        context: { reuseExistingPane: false } as any,
      })
    );
    expect(code).toContain('createPane');
    expect(code).not.toMatch(/getPane\([^)]*\)[\s\S]{0,60}\.select\(\)[\s\S]{0,10}return/);
  });
});

describe('generateBasicScript — state = 1 for all command triggers', () => {
  for (const kind of ['MainGridButton', 'SubgridButton'] as const) {
    it(`${kind} with expandOnOpen: true emits state = 1`, () => {
      const code = generateBasicScript(
        cfg({
          trigger: { kind } as any,
          behavior: { expandOnOpen: true } as any,
          pane: { isSelected: true } as any,
        })
      );
      expect(code).toContain('state = 1');
    });

    it(`${kind} with expandOnOpen: false omits state = 1`, () => {
      const code = generateBasicScript(
        cfg({ trigger: { kind } as any, behavior: { expandOnOpen: false } as any })
      );
      expect(code).not.toContain('state = 1');
    });
  }
});

describe('generateBasicScript — getPane null guard', () => {
  it('uses !existing not === null', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'FormButton' } as any }));
    expect(code).not.toContain('=== null');
    expect(code).not.toContain('== null');
  });
});

describe('buildNavigateInput — pageType branches', () => {
  it('entityrecord + FormOnLoad emits formContext.data.entity.getId()', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormOnLoad' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '', name: '' },
      })
    );
    expect(code).toContain('pageType: "entityrecord"');
    expect(code).toContain('entityName: "account"');
    expect(code).toContain('formContext.data.entity.getId()');
  });

  it('entityrecord + FormButton emits primaryControl.data.entity.getId()', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '', name: '' },
      })
    );
    expect(code).toContain('primaryControl.data.entity.getId()');
    expect(code).not.toContain('entityId: recordId');
  });

  it('entityrecord + MainGridButton uses the selected row ID', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'MainGridButton' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '', name: '' },
      })
    );
    expect(code).toContain('selectedRows.getLength() === 0');
    expect(code).toContain('var selectedRecordId = selectedRows.get(0).getData().getEntity().getId();');
    expect(code).toContain('entityId: selectedRecordId');
    expect(code).not.toContain("entityId: ''");
  });

  it('entityrecord + SubgridButton uses the selected row ID', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'SubgridButton' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '', name: '' },
      })
    );
    expect(code).toContain('var selectedRecordId = selectedRows.get(0).getData().getEntity().getId();');
    expect(code).toContain('entityId: selectedRecordId');
    expect(code).not.toContain("entityId: ''");
  });

  it('entityrecord + ManualJS uses a valid static record ID', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'ManualJS' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '', name: '' },
        context: {
          mode: 'Static',
          entityName: 'account',
          staticRecordId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
          reuseExistingPane: true,
        },
      })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('entityId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"');
    expect(code).not.toContain("entityId: ''");
  });

  it('entityrecord + ManualJS without valid static record ID throws before navigation input is usable', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'ManualJS' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '', name: '' },
        context: { mode: 'Static', entityName: 'account', staticRecordId: 'not-a-guid', reuseExistingPane: true },
      })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('A valid static record ID is required');
    expect(code).not.toContain("entityId: ''");
  });

  it('entityrecord uses context.entityName when set', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '', name: '' },
        context: { mode: 'CurrentRecord', entityName: 'contact', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('entityName: "contact"');
  });

  it('entityrecord falls back to target.entityName when context.entityName is empty', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '', name: '' },
        context: { mode: 'CurrentRecord', entityName: '', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('entityName: "account"');
  });

  it('entitylist uses context.entityName when set', () => {
    const code = generateBasicScript(
      cfg({
        target: { pageType: 'entitylist', entityName: 'account', entityId: '', name: '' },
        context: { mode: 'None', entityName: 'contact', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('entityName: "contact"');
  });

  it('entitylist emits pageType and entityName but no entityId', () => {
    const code = generateBasicScript(
      cfg({ target: { pageType: 'entitylist', entityName: 'contact', entityId: '', name: '' } })
    );
    expect(code).toContain('pageType: "entitylist"');
    expect(code).toContain('entityName: "contact"');
    expect(code).not.toContain('entityId');
  });

  it('webresource emits webresourceName key', () => {
    const code = generateBasicScript(
      cfg({ target: { pageType: 'webresource', name: 'new_mypage.html', entityName: '', entityId: '' } })
    );
    expect(code).toContain('pageType: "webresource"');
    expect(code).toContain('webresourceName: "new_mypage.html"');
    expect(code).not.toContain('entityName');
  });

  it('dashboard pageType throws descriptive error', () => {
    expect(() =>
      generateBasicScript(
        cfg({ target: { pageType: 'dashboard' as any, name: 'myDashboard', entityName: '', entityId: '' } })
      )
    ).toThrow('dashboard pageType is not yet supported');
  });

  it('search pageType throws descriptive error', () => {
    expect(() =>
      generateBasicScript(
        cfg({ target: { pageType: 'search' as any, name: 'mySearch', entityName: '', entityId: '' } })
      )
    ).toThrow('search pageType is not yet supported');
  });
});

describe('generateBasicScript — unknown trigger kind fallback', () => {
  it('unknown kind falls back to generateFormButton (contains __spstudio_pendingPanes)', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'UnknownKind' as any } as any }));
    expect(code).toContain('__spstudio_pendingPanes');
  });
});

describe('generateBasicScript — FormOnChange', () => {
  it('generates addOnChange handler with correct fieldName', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnChange', fieldName: 'new_status', functionName: 'onStatusChange', namespace: 'Contoso' } as any })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('addOnChange');
    expect(code).toContain('"new_status"');
    expect(code).toContain('Contoso.onStatusChange');
  });

  it('FormOnChange does not include pendingPanes guard', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnChange', fieldName: 'new_field' } as any })
    );
    expect(code).not.toContain('__spstudio_pendingPanes');
  });

  it('FormOnChange addOnChange is a comment not a live module-scope call', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnChange', fieldName: 'new_field' } as any })
    );
    expect(code).toContain('addOnChange');
    expect(code).not.toMatch(/^executionContext\.getFormContext/m);
  });

  it('FormOnChange output contains 150ms debounce pattern', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnChange', fieldName: 'new_field' } as any })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('clearTimeout');
    expect(code).toContain('setTimeout');
    expect(code).toContain('150');
    expect(code).not.toContain('__spstudio_pendingPanes');
  });
});

describe('generateBasicScript — closeOthers', () => {
  it('closeOthers: true emits getAllPanes forEach close after navigate', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        behavior: { closeOthers: true } as any,
      })
    );
    expect(code).toContain('getAllPanes');
    expect(code).toContain('forEach');
    expect(isValidJS(code)).toBe(true);
  });

  it('closeOthers: false does not emit getAllPanes', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        behavior: { closeOthers: false } as any,
      })
    );
    expect(code).not.toContain('getAllPanes');
  });
});

describe('buildPaneOptions — isSelected and canClose', () => {
  it('isSelected: false is emitted in output', () => {
    const code = generateBasicScript(cfg({ pane: { isSelected: false } as any }));
    expect(code).toContain('isSelected: false');
  });

  it('isSelected: true is not emitted (API default)', () => {
    const code = generateBasicScript(cfg({ pane: { isSelected: true } as any }));
    expect(code).not.toContain('isSelected: false');
  });

  it('hideHeader: true coerces canClose to false regardless of canClose config', () => {
    const code = generateBasicScript(cfg({ pane: { hideHeader: true, canClose: true } as any }));
    expect(code).toContain('canClose: false');
  });

  it('canClose: true is emitted explicitly because the runtime default does not show the close button', () => {
    const code = generateBasicScript(cfg({ pane: { hideHeader: false, canClose: true } as any }));
    expect(code).toContain('canClose: true');
    expect(code).not.toContain('canClose: omitted');
  });

  it('badgeValue is emitted when non-zero', () => {
    const code = generateBasicScript(cfg({ pane: { badgeValue: 5 } as any }));
    expect(code).toContain('badge: 5');
  });

  it('badgeValue is omitted when zero', () => {
    const code = generateBasicScript(cfg({ pane: { badgeValue: 0 } as any }));
    expect(code).not.toContain('badge');
  });
});

describe('generateLibraryScript', () => {
  it('produces valid JS calling SidePaneHelper.open', () => {
    const code = generateLibraryScript(cfg());
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('SidePaneHelper.open');
  });

  it('includes paneId and pageType', () => {
    const code = generateLibraryScript(cfg({ pane: { paneId: 'myPane' } as any, target: { pageType: 'custom', name: 'cpp_Page' } as any }));
    expect(code).toContain('"myPane"');
    expect(code).toContain('"custom"');
  });

  it('FormOnLoad uses executionContext parameter', () => {
    const code = generateLibraryScript(cfg({ trigger: { kind: 'FormOnLoad' } as any }));
    expect(code).toContain('function(executionContext)');
  });

  it('ManualJS uses empty parameter', () => {
    const code = generateLibraryScript(cfg({ trigger: { kind: 'ManualJS' } as any }));
    expect(code).toContain('function()');
  });

  it('string with single quote is safely escaped', () => {
    const code = generateLibraryScript(cfg({ pane: { paneId: "O'Brien" } as any }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('"O\'Brien"');
  });

  it('keepBadgeOnSelect: true is included in library script output', () => {
    const code = generateLibraryScript(cfg({ pane: { keepBadgeOnSelect: true } as any }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('keepBadgeOnSelect: true');
  });

  it('badgeValue is included in library script output when non-zero', () => {
    const code = generateLibraryScript(cfg({ pane: { badgeValue: 3 } as any }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('badge: 3');
  });

  it('badgeValue is omitted in library script output when zero', () => {
    const code = generateLibraryScript(cfg({ pane: { badgeValue: 0 } as any }));
    expect(isValidJS(code)).toBe(true);
    expect(code).not.toContain('badge');
  });
});
