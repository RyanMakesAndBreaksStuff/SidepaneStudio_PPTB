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
  it('reuseExistingPane: true selects AND navigates the existing pane before returning', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormButton' } as any, context: { reuseExistingPane: true } as any })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('existing.select();');
    expect(code).toContain('await existing.navigate(');
    // the bare focus-only early return must be gone
    expect(code).not.toMatch(/existing\.select\(\);\s*return;/);
  });

  it('reuseExistingPane: true navigates the existing pane with the same input as createPane', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        target: { pageType: 'entitylist', entityName: 'account' },
        context: { mode: 'None', entityName: '', staticRecordId: '', reuseExistingPane: true },
      })
    );
    const occurrences = code.match(/pageType: "entitylist", entityName: "account"/g) || [];
    expect(occurrences.length).toBe(2);
  });

  it('reuseExistingPane: false closes the existing pane and proceeds to createPane', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormButton' } as any, context: { reuseExistingPane: false } as any })
    );
    expect(code).toContain('existing.close()');
    expect(code).toContain('createPane');
    expect(code).not.toContain('existing.select()');
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
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
        context: { mode: 'CurrentRecord', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
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
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
        context: { mode: 'CurrentRecord', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('primaryControl.data.entity.getId()');
    expect(code).not.toContain('entityId: recordId');
  });

  it('entityrecord + MainGridButton uses the selected row ID', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'MainGridButton' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
        context: { mode: 'CurrentRecord', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
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
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
        context: { mode: 'CurrentRecord', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
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
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
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
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
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
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
        context: { mode: 'CurrentRecord', entityName: 'contact', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('entityName: "contact"');
  });

  it('entityrecord falls back to target.entityName when context.entityName is empty', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' } as any,
        target: { pageType: 'entityrecord', entityName: 'account', entityId: '' },
        context: { mode: 'CurrentRecord', entityName: '', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('entityName: "account"');
  });

  it('entitylist uses context.entityName when set', () => {
    const code = generateBasicScript(
      cfg({
        target: { pageType: 'entitylist', entityName: 'account' },
        context: { mode: 'None', entityName: 'contact', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('entityName: "contact"');
  });

  it('entitylist emits pageType and entityName but no entityId', () => {
    const code = generateBasicScript(
      cfg({ target: { pageType: 'entitylist', entityName: 'contact' } })
    );
    expect(code).toContain('pageType: "entitylist"');
    expect(code).toContain('entityName: "contact"');
    expect(code).not.toContain('entityId');
  });

  it('webresource emits webresourceName key', () => {
    const code = generateBasicScript(
      cfg({ target: { pageType: 'webresource', name: 'new_mypage.html' } })
    );
    expect(code).toContain('pageType: "webresource"');
    expect(code).toContain('webresourceName: "new_mypage.html"');
    expect(code).not.toContain('entityName');
  });

  it('generates dashboard pane code with dashboardId', () => {
    const config = cfg({
      target: { pageType: 'dashboard', dashboardId: 'aaa-bbb-ccc', dashboardName: 'Sales Dashboard' },
      trigger: { kind: 'FormButton', functionName: 'openPane', namespace: 'Contoso', fieldName: '' },
    });
    const code = generateBasicScript(config);
    expect(code).toContain('pageType: "dashboard"');
    expect(code).toContain('dashboardId: "aaa-bbb-ccc"');
  });

  it('generates search pane code with searchText when provided', () => {
    const config = cfg({
      target: { pageType: 'search', searchText: 'Contoso' },
      trigger: { kind: 'FormButton', functionName: 'openPane', namespace: 'Contoso', fieldName: '' },
    });
    const code = generateBasicScript(config);
    expect(code).toContain('pageType: "search"');
    expect(code).toContain('searchText: "Contoso"');
  });

  it('generates search pane code without searchText when empty', () => {
    const config = cfg({
      target: { pageType: 'search', searchText: '' },
      trigger: { kind: 'FormButton', functionName: 'openPane', namespace: 'Contoso', fieldName: '' },
    });
    const code = generateBasicScript(config);
    expect(code).toContain('pageType: "search"');
    expect(code).not.toContain('searchText');
  });

  it('generateLibraryScript includes dashboardId for dashboard type', () => {
    const config = cfg({
      target: { pageType: 'dashboard', dashboardId: 'aaa-bbb-ccc', dashboardName: 'Sales' },
    });
    const code = generateLibraryScript(config);
    expect(code).toContain('dashboardId: "aaa-bbb-ccc"');
  });

  it('generateLibraryScript includes searchText for search type when non-empty', () => {
    const config = cfg({
      target: { pageType: 'search', searchText: 'test query' },
    });
    const code = generateLibraryScript(config);
    expect(code).toContain('searchText: "test query"');
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

  it('never emits isResizable — it is not a documented paneOption', () => {
    for (const isResizable of [true, false]) {
      const code = generateBasicScript(cfg({ pane: { isResizable } as any }));
      expect(code).not.toContain('isResizable');
    }
  });

  it('badge is assigned on the pane after navigate, never inside createPane', () => {
    const code = generateBasicScript(cfg({ pane: { badgeValue: 5 } as any }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('pane.badge = 5;');
    expect(code).not.toContain('badge: 5');
    expect(code.indexOf('pane.navigate(')).toBeLessThan(code.indexOf('pane.badge = 5;'));
  });

  it('badgeValue of zero emits no badge assignment', () => {
    const code = generateBasicScript(cfg({ pane: { badgeValue: 0 } as any }));
    expect(code).not.toContain('badge');
  });

  it('imageSrc is prefixed with WebResources/ when unprefixed', () => {
    const code = generateBasicScript(cfg({ pane: { imageSrc: 'sps_/icons/myicon.svg' } as any }));
    expect(code).toContain('imageSrc: "WebResources/sps_/icons/myicon.svg"');
  });

  it('imageSrc already prefixed with WebResources/ is left alone', () => {
    const code = generateBasicScript(cfg({ pane: { imageSrc: 'WebResources/sps_/icons/myicon.svg' } as any }));
    expect(code).toContain('imageSrc: "WebResources/sps_/icons/myicon.svg"');
    expect(code).not.toContain('WebResources/WebResources/');
  });
});

describe('generateLibraryScript', () => {
  it('produces valid JS calling SidePaneHelper.open', () => {
    const code = generateLibraryScript(cfg());
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('SidePaneHelper.open');
  });

  it('includes paneId and pageType', () => {
    const code = generateLibraryScript(cfg({ pane: { paneId: 'myPane' } as any, target: { pageType: 'custom', name: 'sps_Page' } as any }));
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

describe('buildNavigateInput — record context (CR-001)', () => {
  it('default config (custom page + CurrentRecord + FormButton) emits recordId and entityName', () => {
    const code = generateBasicScript(
      cfg({ context: { mode: 'CurrentRecord', entityName: 'account', staticRecordId: '', reuseExistingPane: true } })
    );
    expect(code).toContain('pageType: "custom"');
    expect(code).toContain('entityName: "account"');
    expect(code).toContain('recordId: primaryControl.data.entity.getId()');
  });

  it('custom page omits both record fields when context.mode is None', () => {
    const code = generateBasicScript(
      cfg({ context: { mode: 'None', entityName: 'account', staticRecordId: '', reuseExistingPane: true } })
    );
    expect(code).toContain('pageType: "custom"');
    expect(code).not.toContain('recordId');
    expect(code).not.toContain('entityName');
  });

  it('custom page omits both record fields when entityName is unknown', () => {
    const code = generateBasicScript(
      cfg({ context: { mode: 'CurrentRecord', entityName: '', staticRecordId: '', reuseExistingPane: true } })
    );
    expect(code).not.toContain('recordId');
  });

  it('custom page + FormOnLoad uses formContext', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormOnLoad', functionName: 'openPane', namespace: 'Contoso', fieldName: '' },
        context: { mode: 'CurrentRecord', entityName: 'contact', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('recordId: formContext.data.entity.getId()');
  });

  it('custom page + SelectedRow + SubgridButton uses selectedRecordId', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'SubgridButton', functionName: 'openPane', namespace: 'Contoso', fieldName: '' },
        context: { mode: 'SelectedRow', entityName: 'contact', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('recordId: selectedRecordId');
  });

  it('custom page + Static emits the normalized GUID literal', () => {
    const code = generateBasicScript(
      cfg({
        context: {
          mode: 'Static',
          entityName: 'account',
          staticRecordId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
          reuseExistingPane: true,
        },
      })
    );
    expect(code).toContain('recordId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"');
  });

  it('webresource emits URL-encoded JSON data when a record resolves', () => {
    const code = generateBasicScript(
      cfg({
        target: { pageType: 'webresource', name: 'new_mypage.html' },
        context: { mode: 'CurrentRecord', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).toContain('webresourceName: "new_mypage.html"');
    expect(code).toContain(
      'data: encodeURIComponent(JSON.stringify({ entityName: "account", recordId: primaryControl.data.entity.getId() }))'
    );
  });

  it('webresource omits data when context.mode is None', () => {
    const code = generateBasicScript(
      cfg({
        target: { pageType: 'webresource', name: 'new_mypage.html' },
        context: { mode: 'None', entityName: 'account', staticRecordId: '', reuseExistingPane: true },
      })
    );
    expect(code).not.toContain('data:');
  });
});

describe('generateBasicScript — error surfacing (WR-005)', () => {
  for (const kind of ['FormOnLoad', 'FormButton', 'MainGridButton', 'SubgridButton', 'ManualJS', 'FormOnChange'] as const) {
    it(`${kind} opens an error dialog as well as logging`, () => {
      const code = generateBasicScript(
        cfg({ trigger: { kind, fieldName: kind === 'FormOnChange' ? 'new_field' : '' } as any })
      );
      expect(isValidJS(code)).toBe(true);
      expect(code).toContain('console.error(');
      expect(code).toContain('Xrm.Navigation.openErrorDialog({ message: e.message })');
    });
  }
});
