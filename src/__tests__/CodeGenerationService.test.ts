import { describe, it, expect, vi } from 'vitest';
import { GENERATED_NAMES, generateBasicScript, generateLibraryScript } from '../services/CodeGenerationService';
import { cfg } from './testHelpers';
import { TRIGGER_KINDS } from '../services/triggerCapabilities';
import type { PaneDefinitionConfig, TriggerKind } from '../types/PaneDefinitionConfig';

function isValidJS(code: string): boolean {
  try {
    new Function(code);
    return true;
  } catch {
    return false;
  }
}

describe('generateBasicScript — syntax validity', () => {
  for (const kind of TRIGGER_KINDS) {
    it(`${kind} produces valid JS`, () => {
      const config = cfg({ trigger: { kind }, host: { attribute: 'new_field', lookupControls: ['parentaccountid'] } });
      const code = generateBasicScript(config);
      expect(code.length).toBeGreaterThan(0);
      expect(isValidJS(code)).toBe(true);
    });
  }
});

describe('record variable', () => {
  it('declares the configured variable once and reuses it in the navigate input', () => {
    const code = generateBasicScript(cfg({ host: { entityName: 'account' }, context: { source: { kind: 'host' }, variableName: 'accountId' } }));
    expect(code.match(/var accountId = /g)).toHaveLength(1);
    expect(code).toContain('recordId: accountId');
  });
  it('falls back to recordId for an unsafe variable name and declares nothing for create mode or no record', () => {
    expect(generateBasicScript(cfg({ host: { entityName: 'account' }, context: { source: { kind: 'host' }, variableName: 'bad name' } }))).toContain('var recordId = ');
    expect(generateBasicScript(cfg({ context: { source: { kind: 'none' } } }))).not.toContain('var recordId');
    expect(generateBasicScript(cfg({ host: { entityName: 'account' }, target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true }, context: { source: { kind: 'host' } } }))).not.toContain('var recordId');
  });
});

describe('record variable name collisions', () => {
  const formRecord = { data: { entity: { getEntityName: () => 'account', getId: () => '{A1}' } } };

  async function openWith(variableName: string) {
    const pane = { navigate: vi.fn().mockResolvedValue(undefined) };
    const xrm = {
      App: { sidePanes: { state: 0, getPane: vi.fn(), createPane: vi.fn().mockResolvedValue(pane), getAllPanes: vi.fn().mockReturnValue([]) } },
      Navigation: { openErrorDialog: vi.fn(), openAlertDialog: vi.fn() },
    };
    const config = cfg({
      pane: { paneId: 'p' },
      trigger: { kind: 'FormButton', namespace: 'TestNs', functionName: 'open' },
      target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
      host: { entityName: 'account' },
      context: { source: { kind: 'host' }, variableName },
    });
    const code = generateBasicScript(config);
    const open = new Function('window', 'Xrm', `${code}
return TestNs.open;`)({}, xrm) as (arg: unknown) => void;
    open(formRecord);
    await vi.waitFor(() => expect(pane.navigate).toHaveBeenCalled());
    expect(xrm.Navigation.openErrorDialog).not.toHaveBeenCalled();
    return { code, input: pane.navigate.mock.calls[0][0] };
  }

  it.each([...GENERATED_NAMES])('falls back to recordId when the variable is named %s', async name => {
    const { code, input } = await openWith(name);
    expect(code).toContain('var recordId = primaryControl.data.entity.getId();');
    expect(input).toEqual({ pageType: 'entityrecord', entityName: 'account', entityId: '{A1}' });
  });

  it('keeps a name the script does not use', async () => {
    const { code, input } = await openWith('accountId');
    expect(code).toContain('var accountId = primaryControl.data.entity.getId();');
    expect(input).toMatchObject({ entityId: '{A1}' });
  });
});

describe('generateBasicScript — state = 1 rules', () => {
  it('FormOnLoad NEVER emits state = 1', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnLoad' }, behavior: { expandOnOpen: true } })
    );
    expect(code).not.toContain('state = 1');
  });

  it('FormButton with expandOnOpen emits state = 1', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' },
        behavior: { expandOnOpen: true },
        pane: { isSelected: true },
      })
    );
    expect(code).toContain('state = 1');
  });

  it('FormButton with expandOnOpen: false omits state = 1', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormButton' }, behavior: { expandOnOpen: false } })
    );
    expect(code).not.toContain('state = 1');
  });

  it('FormButton with isSelected: false omits state = 1', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' },
        pane: { isSelected: false },
        behavior: { expandOnOpen: true },
      })
    );
    expect(code).not.toContain('state = 1');
  });
});

describe('generateBasicScript — pending cache', () => {
  it('FormButton includes namespaced pending cache', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'FormButton' } }));
    expect(code).toContain('window.__spstudio_pendingPanes');
    expect(code).not.toContain('window._pendingPanes');
  });

  it('ManualJS has no pending cache', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'ManualJS' } }));
    expect(code).not.toContain('_pendingPanes');
  });

  it('ManualJS is a named async IIFE', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'ManualJS', functionName: 'myFunc' } }));
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
  it('reuseExistingPane: true selects AND navigates the existing pane', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormButton' }, behavior: { reuseExistingPane: true } })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('existing.select();');
    expect(code).toContain('await existing.navigate(');
    // navigation must happen before focus in the reuse branch
    expect(code).not.toMatch(/existing\.select\(\);\s*await existing\.navigate/);
  });

  it('navigates an existing pane before selecting it', () => {
    const code = generateBasicScript(cfg({ behavior: { reuseExistingPane: true } }));
    expect(code.indexOf('await existing.navigate(')).toBeGreaterThan(-1);
    expect(code.indexOf('existing.select()')).toBeGreaterThan(code.indexOf('await existing.navigate('));
  });

  it('generated FormButton closes other panes after reusing one', async () => {
    const events: string[] = [];
    const pane = {
      paneId: 'p',
      navigate: vi.fn().mockImplementation(async () => { events.push('navigate'); }),
      select: vi.fn(() => { events.push('select'); }),
    };
    const other = { paneId: 'other', close: vi.fn(() => { events.push('closeOther'); }) };
    const xrm = { App: { sidePanes: {
      getPane: vi.fn().mockReturnValue(pane),
      createPane: vi.fn(),
      getAllPanes: vi.fn().mockReturnValue([pane, other]),
    } }, Navigation: { openErrorDialog: vi.fn() } };
    const config = cfg({
      pane: { paneId: 'p' },
      trigger: { kind: 'FormButton', namespace: 'TestNs', functionName: 'open' },
      context: { source: { kind: 'none' } },
      behavior: { closeOthers: true },
    });
    const fakeWindow = {};
    const handler = new Function('window', 'Xrm',
      `${generateBasicScript(config)}\nreturn TestNs.open;`
    )(fakeWindow, xrm) as () => void;
    handler();
    await vi.waitFor(() => expect(other.close).toHaveBeenCalledOnce());
    expect(events).toEqual(['navigate', 'select', 'closeOther']);
    expect(xrm.App.sidePanes.createPane).not.toHaveBeenCalled();
  });

  it('reuseExistingPane: true navigates the existing pane with the same input as createPane', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' },
        target: { pageType: 'entitylist', entityName: 'account', viewId: '', viewType: '' },
        host: { entityName: '' }, context: { source: { kind: 'none' } },
      })
    );
    const occurrences = code.match(/pageType: "entitylist", entityName: "account"/g) || [];
    expect(occurrences.length).toBe(2);
  });

  it('reuseExistingPane: false closes the existing pane and proceeds to createPane', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormButton' }, behavior: { reuseExistingPane: false } })
    );
    expect(code).toContain('existing.close()');
    expect(code).toContain('createPane');
    expect(code).not.toContain('existing.select()');
  });
});

describe('generateBasicScript — state = 1 for all command triggers', () => {
  for (const kind of ['GridButton', 'GridButton'] as const) {
    it(`${kind} with expandOnOpen: true emits state = 1`, () => {
      const code = generateBasicScript(
        cfg({
          trigger: { kind },
          behavior: { expandOnOpen: true },
          pane: { isSelected: true },
        })
      );
      expect(code).toContain('state = 1');
    });

    it(`${kind} with expandOnOpen: false omits state = 1`, () => {
      const code = generateBasicScript(
        cfg({ trigger: { kind }, behavior: { expandOnOpen: false } })
      );
      expect(code).not.toContain('state = 1');
    });
  }
});

describe('generateBasicScript — getPane null guard', () => {
  it('uses !existing not === null', () => {
    const code = generateBasicScript(cfg({ trigger: { kind: 'FormButton' } }));
    expect(code).not.toContain('=== null');
    expect(code).not.toContain('== null');
  });
});

describe('buildNavigateInput — pageType branches', () => {
  it('entityrecord + FormOnLoad emits formContext.data.entity.getId()', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormOnLoad' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        host: { entityName: 'account' }, context: { source: { kind: 'host' } },
      })
    );
    expect(code).toContain('pageType: "entityrecord"');
    expect(code).toContain('entityName: "account"');
    expect(code).toContain('var recordId = formContext.data.entity.getId();');
    expect(code).toContain('entityId: recordId');
  });

  it('entityrecord + FormButton emits primaryControl.data.entity.getId()', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        host: { entityName: 'account' }, context: { source: { kind: 'host' } },
      })
    );
    expect(code).toContain('var recordId = primaryControl.data.entity.getId();');
    expect(code).toContain('entityId: recordId');
  });

  it('entityrecord + GridButton uses the selected row ID', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'GridButton' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        host: { entityName: 'account' }, context: { source: { kind: 'selectedRow' } },
      })
    );
    expect(code).toContain('selectedRows.getLength() === 0');
    expect(code).toContain('var selectedEntity = selectedRows.get(0).getData().getEntity();');
    expect(code).toContain('var selectedRecordId = selectedEntity.getId();');
    expect(code).toContain('var recordId = selectedRecordId;');
    expect(code).toContain('entityId: recordId');
    expect(code).not.toContain("entityId: ''");
  });

  it('entityrecord + GridButton on a subgrid uses the selected row ID', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'GridButton', surface: 'subgrid' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        host: { entityName: 'account' }, context: { source: { kind: 'selectedRow' } },
      })
    );
    expect(code).toContain('var selectedEntity = selectedRows.get(0).getData().getEntity();');
    expect(code).toContain('var selectedRecordId = selectedEntity.getId();');
    expect(code).toContain('entityId: recordId');
    expect(code).not.toContain("entityId: ''");
  });

  it('entityrecord + GridRowSelect uses getEventSource().getId()', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'GridRowSelect' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        host: { entityName: 'account' }, context: { source: { kind: 'selectedRow' } },
      })
    );
    expect(code).toContain('function(executionContext)');
    expect(code).toContain('var selectedEntity = executionContext.getEventSource();');
    expect(code).toContain('var selectedRecordId = selectedEntity.getId();');
    expect(code).toContain('entityId: recordId');
    expect(code).not.toContain('primaryControl');
  });

  it('entityrecord + ManualJS uses a valid static record ID', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'ManualJS' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        context: { source: { kind: 'fixed', entityName: 'account', id: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}' } },
      })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('var recordId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";');
    expect(code).toContain('entityId: recordId');
    expect(code).not.toContain("entityId: ''");
  });

  it('entityrecord + ManualJS without valid static record ID throws before navigation input is usable', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'ManualJS' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        context: { source: { kind: 'fixed', entityName: 'account', id: 'not-a-guid' } },
      })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('A valid static record ID is required');
    expect(code).not.toContain("entityId: ''");
  });

  it('entityrecord emits the host table literal when set', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        host: { entityName: 'account' }, context: { source: { kind: 'host' } },
      })
    );
    expect(code).toContain('entityName: "account"');
  });

  it('entityrecord reads the table at runtime when no host table is configured', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' },
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        host: { entityName: '' }, context: { source: { kind: 'host' } },
      })
    );
    expect(code).toContain('entityName: primaryControl.data.entity.getEntityName()');
  });

  it('entitylist emits pageType and entityName but no entityId', () => {
    const code = generateBasicScript(
      cfg({ target: { pageType: 'entitylist', entityName: 'contact', viewId: '', viewType: '' } })
    );
    expect(code).toContain('pageType: "entitylist"');
    expect(code).toContain('entityName: "contact"');
    expect(code).not.toContain('entityId');
  });

  it('webresource emits webresourceName key', () => {
    const code = generateBasicScript(
      cfg({ target: { pageType: 'webresource', name: 'new_mypage.html' }, context: { source: { kind: 'none' } } })
    );
    expect(code).toContain('pageType: "webresource"');
    expect(code).toContain('webresourceName: "new_mypage.html"');
    expect(code).not.toContain('entityName');
  });

  it('generates dashboard pane code with dashboardId', () => {
    const config = cfg({
      target: { pageType: 'dashboard', dashboardId: 'aaa-bbb-ccc', dashboardName: 'Sales Dashboard' },
      trigger: { kind: 'FormButton', functionName: 'openPane', namespace: 'Contoso' },
    });
    const code = generateBasicScript(config);
    expect(code).toContain('pageType: "dashboard"');
    expect(code).toContain('dashboardId: "aaa-bbb-ccc"');
  });

  it('generates search pane code with searchText when provided', () => {
    const config = cfg({
      target: { pageType: 'search', searchText: 'Contoso' },
      trigger: { kind: 'FormButton', functionName: 'openPane', namespace: 'Contoso' },
    });
    const code = generateBasicScript(config);
    expect(code).toContain('pageType: "search"');
    expect(code).toContain('searchText: "Contoso"');
  });

  it('generates search pane code without searchText when empty', () => {
    const config = cfg({
      target: { pageType: 'search', searchText: '' },
      trigger: { kind: 'FormButton', functionName: 'openPane', namespace: 'Contoso' },
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
    // Deliberate cast: a stored config may carry a kind this build does not know.
    const code = generateBasicScript(cfg({ trigger: { kind: 'UnknownKind' as TriggerKind } }));
    expect(code).toContain('__spstudio_pendingPanes');
  });
});

describe('generateBasicScript — FormOnChange', () => {
  it('generates addOnChange handler with correct fieldName', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnChange', functionName: 'onStatusChange', namespace: 'Contoso' }, host: { attribute: 'new_status' } })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('addOnChange');
    expect(code).toContain('"new_status"');
    expect(code).toContain('Contoso.onStatusChange');
  });

  it('FormOnChange does not include pendingPanes guard', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnChange' }, host: { attribute: 'new_field' } })
    );
    expect(code).not.toContain('__spstudio_pendingPanes');
  });

  it('FormOnChange addOnChange is a comment not a live module-scope call', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnChange' }, host: { attribute: 'new_field' } })
    );
    expect(code).toContain('addOnChange');
    expect(code).not.toMatch(/^executionContext\.getFormContext/m);
  });

  it('FormOnChange output contains 150ms debounce pattern', () => {
    const code = generateBasicScript(
      cfg({ trigger: { kind: 'FormOnChange' }, host: { attribute: 'new_field' } })
    );
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('clearTimeout');
    expect(code).toContain('setTimeout');
    expect(code).toContain('150');
    expect(code).not.toContain('__spstudio_pendingPanes');
  });
});

describe('generateBasicScript — LookupTagClick', () => {
  const lookup = {
    ...cfg({}).trigger,
    kind: 'LookupTagClick' as const,
    namespace: 'Contoso',
    functionName: 'openTag',
  };

  it('cancels default navigation and uses the clicked tag', () => {
    const code = generateBasicScript(cfg({ trigger: lookup, host: { lookupControls: ['parentaccountid'] }, context: { source: { kind: 'clickedTag' } }, target: {
      pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '',
    } }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('eventArgs.preventDefault()');
    expect(code).toContain('eventArgs.getTagValue()');
    expect(code).toContain('var recordId = tag.id;');
    expect(code).toContain('entityName: tag.entityType');
    expect(code).toContain('entityId: recordId');
    expect(code).toContain('addOnLookupTagClick(Contoso.openTag)');
  });

  it('sends the clicked tag to a web resource as URL data', () => {
    const code = generateBasicScript(cfg({ trigger: lookup, host: { lookupControls: ['parentaccountid'] }, context: { source: { kind: 'clickedTag' } }, target: { pageType: 'webresource', name: 'new_mypage.html' } }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('data: encodeURIComponent(JSON.stringify({ entityName: tag.entityType, recordId: recordId }))');
  });

  it('emits the same event preamble and tag options for Shared Library output', () => {
    const code = generateLibraryScript(cfg({ trigger: lookup, host: { lookupControls: ['parentaccountid'] }, context: { source: { kind: 'clickedTag' } }, target: { pageType: 'custom', name: 'sps_Page' } }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('eventArgs.preventDefault()');
    expect(code).toContain('var recordId = tag.id;');
    expect(code).toContain('recordId: recordId');
    expect(code).toContain('entityName: tag.entityType');
  });
});

describe('generateBasicScript — closeOthers', () => {
  it('closeOthers: true emits getAllPanes forEach close after navigate', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' },
        behavior: { closeOthers: true },
      })
    );
    expect(code).toContain('getAllPanes');
    expect(code).toContain('forEach');
    expect(isValidJS(code)).toBe(true);
  });

  it('closeOthers: false does not emit getAllPanes', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormButton' },
        behavior: { closeOthers: false },
      })
    );
    expect(code).not.toContain('getAllPanes');
  });
});

describe('buildPaneOptions — isSelected and canClose', () => {
  it.each([generateBasicScript, generateLibraryScript])('normalizes unsafe width before generating source', generate => {
      const unsafeWidth: unknown = '480;globalThis.pwned=1';
      const config = cfg();
      Object.assign(config.pane, { width: unsafeWidth }); // a stored config can carry any JSON, whatever the type says
      const code = generate(config);
      expect(isValidJS(code)).toBe(true);
      expect(code).not.toContain('globalThis.pwned');
      if (generate === generateBasicScript) expect(code).toContain('width: 480');
    });

  it('isSelected: false is emitted in output', () => {
    const code = generateBasicScript(cfg({ pane: { isSelected: false } }));
    expect(code).toContain('isSelected: false');
  });

  it('isSelected: true is not emitted (API default)', () => {
    const code = generateBasicScript(cfg({ pane: { isSelected: true } }));
    expect(code).not.toContain('isSelected: false');
  });

  it('hideHeader: true coerces canClose to false regardless of canClose config', () => {
    const code = generateBasicScript(cfg({ pane: { hideHeader: true, canClose: true } }));
    expect(code).toContain('canClose: false');
  });

  it('canClose: true is emitted explicitly because the runtime default does not show the close button', () => {
    const code = generateBasicScript(cfg({ pane: { hideHeader: false, canClose: true } }));
    expect(code).toContain('canClose: true');
    expect(code).not.toContain('canClose: omitted');
  });

  it('never emits isResizable — it is not a documented paneOption', () => {
    for (const isResizable of [true, false]) {
      const code = generateBasicScript(cfg({ pane: { isResizable } }));
      expect(code).not.toContain('isResizable');
    }
  });

  it('badge is assigned on the pane after navigate, never inside createPane', () => {
    const code = generateBasicScript(cfg({ pane: { badgeValue: 5 } }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('pane.badge = 5;');
    expect(code).not.toContain('badge: 5');
    expect(code.indexOf('pane.navigate(')).toBeLessThan(code.indexOf('pane.badge = 5;'));
  });

  it('badgeValue of zero emits no badge assignment', () => {
    const code = generateBasicScript(cfg({ pane: { badgeValue: 0 } }));
    expect(code).not.toContain('badge');
  });

  it('imageSrc is prefixed with WebResources/ when unprefixed', () => {
    const code = generateBasicScript(cfg({ pane: { imageSrc: 'sps_/icons/myicon.svg' } }));
    expect(code).toContain('imageSrc: "WebResources/sps_/icons/myicon.svg"');
  });

  it('imageSrc already prefixed with WebResources/ is left alone', () => {
    const code = generateBasicScript(cfg({ pane: { imageSrc: 'WebResources/sps_/icons/myicon.svg' } }));
    expect(code).toContain('imageSrc: "WebResources/sps_/icons/myicon.svg"');
    // eslint-disable-next-line @microsoft/power-apps/use-cached-webresource -- Asserts an absent malformed path, not a requested resource.
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
    const code = generateLibraryScript(cfg({ pane: { paneId: 'myPane' }, target: { pageType: 'custom', name: 'sps_Page' } }));
    expect(code).toContain('"myPane"');
    expect(code).toContain('"custom"');
  });

  it('FormOnLoad uses executionContext parameter', () => {
    const code = generateLibraryScript(cfg({ trigger: { kind: 'FormOnLoad' } }));
    expect(code).toContain('function(executionContext)');
  });

  it('ManualJS uses empty parameter', () => {
    const code = generateLibraryScript(cfg({ trigger: { kind: 'ManualJS' } }));
    expect(code).toContain('function()');
  });

  it('string with single quote is safely escaped', () => {
    const code = generateLibraryScript(cfg({ pane: { paneId: "O'Brien" } }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('"O\'Brien"');
  });

  it('keepBadgeOnSelect: true is included in library script output', () => {
    const code = generateLibraryScript(cfg({ pane: { keepBadgeOnSelect: true } }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('keepBadgeOnSelect: true');
  });

  it('badgeValue is included in library script output when non-zero', () => {
    const code = generateLibraryScript(cfg({ pane: { badgeValue: 3 } }));
    expect(isValidJS(code)).toBe(true);
    expect(code).toContain('badge: 3');
  });

  it('badgeValue is omitted in library script output when zero', () => {
    const code = generateLibraryScript(cfg({ pane: { badgeValue: 0 } }));
    expect(isValidJS(code)).toBe(true);
    expect(code).not.toContain('badge');
  });

  it('webresource targets emit webresourceName, never name (WR-007)', () => {
    const code = generateLibraryScript(
      cfg({ target: { pageType: 'webresource', name: 'new_mypage.html' } })
    );
    expect(code).toContain('webresourceName: "new_mypage.html"');
    expect(code).not.toContain('name: "new_mypage.html"');
  });

  it('custom targets still emit name, never webresourceName', () => {
    const code = generateLibraryScript(
      cfg({ target: { pageType: 'custom', name: 'sps_Page' } })
    );
    expect(code).toContain('name: "sps_Page"');
    expect(code).not.toContain('webresourceName');
  });

  it('never emits isResizable (contract C3)', () => {
    const code = generateLibraryScript(cfg({ pane: { isResizable: false } }));
    expect(code).not.toContain('isResizable');
  });

  it('entityrecord emits entityId resolved from the record-context matrix', () => {
    const code = generateLibraryScript(
      cfg({
        target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
        context: { source: { kind: 'fixed', entityName: 'account', id: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}' } },
      })
    );
    expect(code).toContain('entityName: "account"');
    expect(code).toContain('var recordId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";');
    expect(code).toContain('entityId: recordId');
  });

  it('custom page emits recordId when a static record resolves', () => {
    const code = generateLibraryScript(
      cfg({
        context: { source: { kind: 'fixed', entityName: 'account', id: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}' } },
      })
    );
    expect(code).toContain('var recordId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";');
    expect(code).toContain('recordId: recordId');
  });

  it('imageSrc is WebResources/-prefixed like the basic script', () => {
    const code = generateLibraryScript(cfg({ pane: { imageSrc: 'sps_/icons/myicon.svg' } }));
    expect(code).toContain('imageSrc: "WebResources/sps_/icons/myicon.svg"');
  });
});

describe('buildNavigateInput — record context (CR-001)', () => {
  it('default config (custom page + CurrentRecord + FormButton) emits recordId and entityName', () => {
    const code = generateBasicScript(
      cfg({ host: { entityName: 'account' }, context: { source: { kind: 'host' } } })
    );
    expect(code).toContain('pageType: "custom"');
    expect(code).toContain('entityName: "account"');
    expect(code).toContain('var recordId = primaryControl.data.entity.getId();');
    expect(code).toContain('recordId: recordId');
  });

  it('custom page omits both record fields when the source is none', () => {
    const code = generateBasicScript(
      cfg({ host: { entityName: 'account' }, context: { source: { kind: 'none' } } })
    );
    expect(code).toContain('pageType: "custom"');
    expect(code).not.toContain('recordId');
    expect(code).not.toContain('entityName');
  });

  it('custom page + host source + no host table emits the runtime table expression', () => {
    const code = generateBasicScript(
      cfg({ host: { entityName: '' }, context: { source: { kind: 'host' } } })
    );
    expect(code).toContain('entityName: primaryControl.data.entity.getEntityName()');
    expect(code).toContain('recordId: recordId');
  });

  it('custom page + FormOnLoad uses formContext', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'FormOnLoad', functionName: 'openPane', namespace: 'Contoso' },
        host: { entityName: 'contact' }, context: { source: { kind: 'host' } },
      })
    );
    expect(code).toContain('var recordId = formContext.data.entity.getId();');
    expect(code).toContain('recordId: recordId');
  });

  it('custom page + SelectedRow + GridButton uses selectedRecordId', () => {
    const code = generateBasicScript(
      cfg({
        trigger: { kind: 'GridButton', functionName: 'openPane', namespace: 'Contoso' },
        host: { entityName: 'contact' }, context: { source: { kind: 'selectedRow' } },
      })
    );
    expect(code).toContain('var recordId = selectedRecordId;');
    expect(code).toContain('recordId: recordId');
  });

  it('custom page + Static emits the normalized GUID literal', () => {
    const code = generateBasicScript(
      cfg({
        context: { source: { kind: 'fixed', entityName: 'account', id: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}' } },
      })
    );
    expect(code).toContain('var recordId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";');
    expect(code).toContain('recordId: recordId');
  });

  it('webresource emits URL-encoded JSON data when a record resolves', () => {
    const code = generateBasicScript(
      cfg({
        target: { pageType: 'webresource', name: 'new_mypage.html' },
        host: { entityName: 'account' }, context: { source: { kind: 'host' } },
      })
    );
    expect(code).toContain('webresourceName: "new_mypage.html"');
    expect(code).toContain(
      'data: encodeURIComponent(JSON.stringify({ entityName: "account", recordId: recordId }))'
    );
    expect(code).toContain('var recordId = primaryControl.data.entity.getId();');
  });

  it('webresource omits data when the source is none', () => {
    const code = generateBasicScript(
      cfg({
        target: { pageType: 'webresource', name: 'new_mypage.html' },
        host: { entityName: 'account' }, context: { source: { kind: 'none' } },
      })
    );
    expect(code).not.toContain('data:');
  });
});

describe('generateBasicScript — error surfacing (WR-005)', () => {
  for (const kind of TRIGGER_KINDS) {
    it(`${kind} opens an error dialog as well as logging`, () => {
      const code = generateBasicScript(
        cfg({ trigger: { kind }, host: { attribute: 'new_field', lookupControls: ['parentaccountid'] } })
      );
      expect(isValidJS(code)).toBe(true);
      expect(code).toContain('console.error(');
      expect(code).toContain('Xrm.Navigation.openErrorDialog({ message: e.message })');
    });
  }
});

describe('generated scripts — RelatedRecord context', () => {
  const related = (kind: TriggerKind) => cfg({
    pane: { paneId: 'p' },
    trigger: { kind, namespace: 'TestNs', functionName: 'open' },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '' },
    host: { entityName: 'account' }, context: { source: { kind: 'lookup', attribute: 'primarycontactid' } },
  });
  const gridRow = { getEventSource: () => ({ getId: () => '{A1}' }) };
  const accountRow = {
    _primarycontactid_value: 'c1',
    '_primarycontactid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'contact',
  };

  function load(config: PaneDefinitionConfig, retrieveRecord = vi.fn()) {
    const pane = { navigate: vi.fn().mockResolvedValue(undefined) };
    const xrm = {
      App: { sidePanes: {
        getPane: vi.fn().mockReturnValue(null),
        createPane: vi.fn().mockResolvedValue(pane),
        getAllPanes: vi.fn().mockReturnValue([]),
      } },
      Navigation: { openErrorDialog: vi.fn() },
      WebApi: { retrieveRecord },
    };
    const win: { __spstudio_pendingPanes?: Record<string, number> } = {};
    const open = new Function('window', 'Xrm',
      `${generateBasicScript(config)}\nreturn TestNs.open;`)(win, xrm) as (arg: unknown) => void;
    return { open, pane, xrm, win };
  }

  it('retrieves the selected grid row lookup and opens that record', async () => {
    const { open, pane, xrm } = load(related('GridRowSelect'), vi.fn().mockResolvedValue(accountRow));
    open(gridRow);
    await vi.waitFor(() => expect(pane.navigate).toHaveBeenCalled());
    expect(xrm.WebApi.retrieveRecord).toHaveBeenCalledWith('account', 'A1', '?$select=_primarycontactid_value');
    expect(pane.navigate).toHaveBeenCalledWith({ pageType: 'entityrecord', entityName: 'contact', entityId: 'c1' });
  });

  it('opens no pane when the selected row has no lookup value', async () => {
    const { open, xrm, win } = load(related('GridRowSelect'), vi.fn().mockResolvedValue({ _primarycontactid_value: null }));
    open(gridRow);
    await vi.waitFor(() => expect(win.__spstudio_pendingPanes).toEqual({}));
    expect(xrm.WebApi.retrieveRecord).toHaveBeenCalledOnce();
    expect(xrm.App.sidePanes.createPane).not.toHaveBeenCalled();
    expect(xrm.Navigation.openErrorDialog).not.toHaveBeenCalled();
  });

  it('reads form triggers from the form attribute, including unsaved values', async () => {
    const { open, pane, xrm } = load(related('FormButton'));
    const getAttribute = vi.fn().mockReturnValue({ getValue: () => [{ id: '{C2}', entityType: 'contact', name: 'Pat' }] });
    open({ getAttribute });
    await vi.waitFor(() => expect(pane.navigate).toHaveBeenCalled());
    expect(getAttribute).toHaveBeenCalledWith('primarycontactid');
    expect(pane.navigate).toHaveBeenCalledWith({ pageType: 'entityrecord', entityName: 'contact', entityId: '{C2}' });
    expect(xrm.WebApi.retrieveRecord).not.toHaveBeenCalled();
  });

  it('reports a lookup column that is missing from the form', async () => {
    const { open, xrm } = load(related('FormButton'));
    open({ getAttribute: () => null });
    await vi.waitFor(() => expect(xrm.Navigation.openErrorDialog)
      .toHaveBeenCalledWith({ message: 'The lookup column primarycontactid is not on this form.' }));
  });

  it('resolves the grid lookup before SidePaneHelper.open in Shared Library output', async () => {
    const open = vi.fn();
    const retrieveRecord = vi.fn().mockResolvedValue(accountRow);
    const handler = new Function('Xrm', 'SidePaneHelper',
      `${generateLibraryScript(related('GridRowSelect'))}\nreturn TestNs.open;`)(
      { WebApi: { retrieveRecord }, Navigation: { openErrorDialog: vi.fn() } }, { open }) as (arg: unknown) => void;
    handler(gridRow);
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls[0][0]).toMatchObject({ pageType: 'entityrecord', entityName: 'contact', entityId: 'c1' });
  });

  it('reads the form lookup through executionContext in Shared Library output', async () => {
    const open = vi.fn();
    const getAttribute = vi.fn().mockReturnValue({ getValue: () => [{ id: '{C2}', entityType: 'contact' }] });
    const handler = new Function('Xrm', 'SidePaneHelper',
      `${generateLibraryScript(related('FormOnLoad'))}\nreturn TestNs.open;`)(
      { Navigation: { openErrorDialog: vi.fn() } }, { open }) as (arg: unknown) => void;
    handler({ getFormContext: () => ({ getAttribute }) });
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls[0][0]).toMatchObject({ entityName: 'contact', entityId: '{C2}' });
  });

  it('adds configured form and tab only when the Basic lookup resolves to the configured table', async () => {
    const config = related('GridRowSelect');
    if (config.target.pageType !== 'entityrecord') throw new Error('Expected an entity record target.');
    config.target.entityName = 'account';
    config.target.formId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    config.target.tabName = 'details';
    const retrieveRecord = vi.fn()
      .mockResolvedValueOnce({ ...accountRow, '_primarycontactid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'account' })
      .mockResolvedValueOnce(accountRow);
    const { open, pane } = load(config, retrieveRecord);

    open(gridRow);
    await vi.waitFor(() => expect(pane.navigate).toHaveBeenCalledTimes(1));
    open(gridRow);
    await vi.waitFor(() => expect(pane.navigate).toHaveBeenCalledTimes(2));

    expect(pane.navigate).toHaveBeenNthCalledWith(1, {
      pageType: 'entityrecord', entityName: 'account', entityId: 'c1',
      formId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', tabName: 'details',
    });
    expect(pane.navigate).toHaveBeenNthCalledWith(2, {
      pageType: 'entityrecord', entityName: 'contact', entityId: 'c1',
    });
  });

  it('adds configured form and tab only when the Shared Library lookup resolves to the configured table', async () => {
    const config = related('GridRowSelect');
    if (config.target.pageType !== 'entityrecord') throw new Error('Expected an entity record target.');
    config.target.entityName = 'account';
    config.target.formId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    config.target.tabName = 'details';
    const retrieveRecord = vi.fn()
      .mockResolvedValueOnce({ ...accountRow, '_primarycontactid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'account' })
      .mockResolvedValueOnce(accountRow);
    const open = vi.fn();
    const handler = new Function('Xrm', 'SidePaneHelper',
      `${generateLibraryScript(config)}\nreturn TestNs.open;`)(
      { WebApi: { retrieveRecord }, Navigation: { openErrorDialog: vi.fn() } }, { open }) as (arg: unknown) => void;

    handler(gridRow);
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    handler(gridRow);
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2));

    expect(open).toHaveBeenNthCalledWith(1, expect.objectContaining({
      pageType: 'entityrecord', entityName: 'account', entityId: 'c1',
      formId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', tabName: 'details',
    }));
    expect(open.mock.calls[1][0]).toMatchObject({ pageType: 'entityrecord', entityName: 'contact', entityId: 'c1' });
    expect(open.mock.calls[1][0]).not.toHaveProperty('formId');
    expect(open.mock.calls[1][0]).not.toHaveProperty('tabName');
  });
});

describe('entityrecord create mode', () => {
  const create = (context: Partial<PaneDefinitionConfig['context']> = {}) => cfg({
    trigger: { kind: 'FormButton' },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: 'details', data: '{"firstname":"Pat"}', createNew: true },
    context: { source: { kind: 'none' }, ...context },
  });

  it.each([generateBasicScript, generateLibraryScript])('omits entityId and keeps tab and data (%#)', generate => {
    const code = generate(create());
    expect(isValidJS(code)).toBe(true);
    expect(code).not.toContain('entityId');
    expect(code).toContain('entityName: "contact"');
    expect(code).toContain('tabName: "details"');
    expect(code).toContain('data: JSON.parse(');
  });

  it.each([generateBasicScript, generateLibraryScript])('uses the target table, never the context table (%#)', generate => {
    const code = generate(create({ source: { kind: 'host' } }));
    expect(code).toContain('entityName: "contact"');
    expect(code).not.toContain('"account"');
  });
});

describe('entityrecord create mode — createFromEntity', () => {
  const prefill = cfg({
    pane: { paneId: 'p' },
    trigger: { kind: 'FormButton', namespace: 'TestNs', functionName: 'open' },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true },
    context: { source: { kind: 'host' } },
  });
  const formRecord = { data: { entity: { getEntityName: () => 'account', getId: () => '{A1}' } } };

  it('passes the form record as createFromEntity in Basic output', async () => {
    const pane = { navigate: vi.fn().mockResolvedValue(undefined) };
    const xrm = { App: { sidePanes: { state: 0, getPane: vi.fn(), createPane: vi.fn().mockResolvedValue(pane), getAllPanes: vi.fn().mockReturnValue([]) } },
      Navigation: { openErrorDialog: vi.fn(), openAlertDialog: vi.fn() } };
    const open = new Function('window', 'Xrm', `${generateBasicScript(prefill)}
return TestNs.open;`)({}, xrm) as (arg: unknown) => void;
    open(formRecord);
    await vi.waitFor(() => expect(pane.navigate).toHaveBeenCalled());
    expect(pane.navigate).toHaveBeenCalledWith({ pageType: 'entityrecord', entityName: 'contact', createFromEntity: { entityType: 'account', id: '{A1}' } });
  });

  it('passes the form record as createFromEntity in Shared Library output', () => {
    const open = vi.fn();
    const onLoad = { ...prefill, trigger: { ...prefill.trigger, kind: 'FormOnLoad' as const } };
    const handler = new Function('Xrm', 'SidePaneHelper', `${generateLibraryScript(onLoad)}
return TestNs.open;`)({}, { open }) as (arg: unknown) => void;
    handler({ getFormContext: () => formRecord });
    expect(open.mock.calls[0][0]).toMatchObject({ entityName: 'contact', createFromEntity: { entityType: 'account', id: '{A1}' } });
    expect(open.mock.calls[0][0]).not.toHaveProperty('entityId');
  });

  it('ignores pre-fill on a console script, which has no current record', () => {
    expect(generateBasicScript({ ...prefill, trigger: { ...prefill.trigger, kind: 'ManualJS' } })).not.toContain('createFromEntity');
  });
});

describe('lookup tag registrar', () => {
  const lookup = cfg({
    pane: { paneId: 'p' },
    trigger: { kind: 'LookupTagClick', namespace: 'TestNs', functionName: 'openTag' },
    host: { lookupControls: ['parentcustomerid', 'primarycontactid'] },
    target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
    context: { source: { kind: 'clickedTag' } },
  });
  type Ns = Record<string, (arg: unknown) => unknown>;

  // Arrays, not Sets: the platform is not documented to ignore a duplicate add, so only remove-then-add keeps one handler.
  function formWith(names: string[]) {
    const handlers = new Map(names.map(name => [name, [] as unknown[]]));
    const executionContext = { getFormContext: () => ({
      getControl: (name: string) => handlers.has(name) ? {
        addOnLookupTagClick: (fn: unknown) => { handlers.get(name)!.push(fn); },
        removeOnLookupTagClick: (fn: unknown) => { handlers.set(name, handlers.get(name)!.filter(handler => handler !== fn)); },
      } : null,
    }) };
    return { handlers, executionContext };
  }
  const tagClick = (id: string, entityType: string) => ({
    getEventArgs: () => ({ preventDefault: vi.fn(), getTagValue: () => ({ id, entityType, name: 'n', fieldName: 'parentcustomerid' }) }),
  });

  it('registers one handler per listed control however often OnLoad runs', () => {
    const ns = new Function('Xrm', `${generateBasicScript(lookup)}\nreturn TestNs;`)({}) as Ns;
    const { handlers, executionContext } = formWith(['parentcustomerid', 'primarycontactid']);
    ns.registerOpenTag(executionContext);
    ns.registerOpenTag(executionContext);
    expect([...handlers.values()]).toEqual([[ns.openTag], [ns.openTag]]);
  });

  it('warns and skips a lookup control that is not on the form', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ns = new Function('Xrm', `${generateBasicScript(lookup)}\nreturn TestNs;`)({}) as Ns;
    const { handlers, executionContext } = formWith(['parentcustomerid']);
    expect(() => ns.registerOpenTag(executionContext)).not.toThrow();
    expect(handlers.get('parentcustomerid')).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith('TestNs.registerOpenTag: no lookup control primarycontactid');
    warn.mockRestore();
  });

  it('opens the clicked tag in Basic output', async () => {
    const pane = { navigate: vi.fn().mockResolvedValue(undefined) };
    const xrm = { App: { sidePanes: { state: 0, getPane: vi.fn(), createPane: vi.fn().mockResolvedValue(pane), getAllPanes: vi.fn().mockReturnValue([]) } },
      Navigation: { openErrorDialog: vi.fn(), openAlertDialog: vi.fn() } };
    const ns = new Function('Xrm', `${generateBasicScript(lookup)}\nreturn TestNs;`)(xrm) as Ns;
    await ns.openTag(tagClick('{C1}', 'contact'));
    expect(pane.navigate).toHaveBeenCalledWith({ pageType: 'entityrecord', entityName: 'contact', entityId: '{C1}' });
  });

  it('registers and opens the clicked tag in Shared Library output', () => {
    const open = vi.fn();
    const ns = new Function('Xrm', 'SidePaneHelper', `${generateLibraryScript(lookup)}\nreturn TestNs;`)({ App: { sidePanes: {} } }, { open }) as Ns;
    const { handlers, executionContext } = formWith(['parentcustomerid', 'primarycontactid']);
    ns.registerOpenTag(executionContext);
    expect(handlers.get('primarycontactid')).toContain(ns.openTag);
    ns.openTag(tagClick('{C1}', 'contact'));
    expect(open.mock.calls[0][0]).toMatchObject({ entityName: 'contact', entityId: '{C1}' });
  });
});

describe('generative page target', () => {
  const generative = (kind: TriggerKind) => cfg({
    pane: { paneId: 'p' },
    trigger: { kind, namespace: 'TestNs', functionName: 'open' },
    host: { entityName: 'account', attribute: 'parentcustomerid', lookupControls: ['parentcustomerid'] },
    target: { pageType: 'generative', pageId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}', data: '' },
    context: { source: kind === 'ManualJS' ? { kind: 'none' as const } : kind === 'LookupTagClick' ? { kind: 'clickedTag' as const } : kind === 'GridButton' || kind === 'GridRowSelect' ? { kind: 'selectedRow' as const } : { kind: 'host' as const } },
  });

  for (const kind of TRIGGER_KINDS) {
    for (const [label, generate] of [['Basic', generateBasicScript], ['Library', generateLibraryScript]] as const) {
      it(`${kind} ${label} output is valid JS with the normalized page ID`, () => {
        const code = generate(generative(kind));
        expect(isValidJS(code)).toBe(true);
        expect(code).toContain('pageId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"');
      });
    }
  }

  it('strips braces from the clicked tag ID before it reaches the page', async () => {
    const pane = { navigate: vi.fn().mockResolvedValue(undefined) };
    const xrm = { App: { sidePanes: { state: 0, getPane: vi.fn(), createPane: vi.fn().mockResolvedValue(pane), getAllPanes: vi.fn().mockReturnValue([]) } },
      Navigation: { openErrorDialog: vi.fn(), openAlertDialog: vi.fn() } };
    const ns = new Function('Xrm', `${generateBasicScript(generative('LookupTagClick'))}\nreturn TestNs;`)(xrm) as Record<string, (arg: unknown) => Promise<void>>;
    await ns.open({ getEventArgs: () => ({ preventDefault: vi.fn(), getTagValue: () => ({ id: '{C1}', entityType: 'contact' }) }) });
    expect(pane.navigate).toHaveBeenCalledWith({ pageType: 'generative', pageId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', entityName: 'contact', recordId: 'C1' });
  });
});

describe('side pane availability guard', () => {
  const COMMAND_KINDS: TriggerKind[] = ['FormButton', 'GridButton', 'GridButton'];
  const preventDefault = vi.fn();
  const triggerArg = {
    getFormContext: () => ({ data: { entity: { getId: () => '{A1}' } } }),
    getEventSource: () => ({ getId: () => '{A1}' }),
    getEventArgs: () => ({ preventDefault, getTagValue: () => ({ id: '{A1}', entityType: 'account' }) }),
    getGrid: () => ({ getSelectedRows: () => ({ getLength: () => 1, get: () => ({ getData: () => ({ getEntity: () => ({ getId: () => '{A1}' }) }) }) }) }),
    data: { entity: { getId: () => '{A1}' } },
  };

  for (const kind of TRIGGER_KINDS) {
    it(`${kind} exits without an error dialog when Xrm.App.sidePanes is missing`, async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const xrm = { Navigation: { openAlertDialog: vi.fn(), openErrorDialog: vi.fn() } };
      preventDefault.mockClear();
      const config = cfg({ pane: { paneId: 'p' }, trigger: { kind, namespace: 'TestNs', functionName: 'open' }, host: { attribute: 'parentcustomerid', lookupControls: ['parentcustomerid'] }, context: { source: { kind: 'none' } } });
      const handler = new Function('window', 'Xrm',
        `${generateBasicScript(config)}\nreturn typeof TestNs === 'undefined' ? undefined : TestNs.open;`)({}, xrm) as ((arg: unknown) => void) | undefined;
      handler?.(triggerArg);
      const command = COMMAND_KINDS.includes(kind);
      await vi.waitFor(() => expect(command ? xrm.Navigation.openAlertDialog : warn).toHaveBeenCalled());
      if (command) {
        expect(xrm.Navigation.openAlertDialog).toHaveBeenCalledWith({ text: 'Side panes are not available in this client.' });
      } else {
        expect(warn).toHaveBeenCalledWith('Side panes are not available in this client.');
        expect(xrm.Navigation.openAlertDialog).not.toHaveBeenCalled();
      }
      expect(xrm.Navigation.openErrorDialog).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled(); // a lookup tag keeps its default navigation
      warn.mockRestore();
      error.mockRestore();
    });
  }

  it('LookupTagClick Library output leaves the default tag navigation alone when side panes are missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const open = vi.fn();
    preventDefault.mockClear();
    const config = cfg({ pane: { paneId: 'p' }, trigger: { kind: 'LookupTagClick', namespace: 'TestNs', functionName: 'open' }, host: { lookupControls: ['parentcustomerid'] }, context: { source: { kind: 'clickedTag' } } });
    const ns = new Function('Xrm', 'SidePaneHelper', `${generateLibraryScript(config)}\nreturn TestNs;`)({}, { open }) as Record<string, (arg: unknown) => void>;
    ns.open(triggerArg);
    expect(warn).toHaveBeenCalledWith('Side panes are not available in this client.');
    expect(preventDefault).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  const GUARD = 'if (!Xrm.App || !Xrm.App.sidePanes)';
  const ALERT = 'Xrm.Navigation.openAlertDialog({ text: "Side panes are not available in this client." })';
  const WARN = 'console.warn("Side panes are not available in this client.")';

  function onlyGuardAt(code: string): number {
    const at = code.indexOf(GUARD);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(code.indexOf(GUARD, at + GUARD.length)).toBe(-1);
    return at;
  }

  it('places one command guard before toggle and the related-record read', () => {
    const code = generateBasicScript(cfg({
      pane: { paneId: 'p' },
      trigger: { kind: 'FormButton', namespace: 'TestNs', functionName: 'open' },
      host: { entityName: 'account' }, context: { source: { kind: 'lookup', attribute: 'primarycontactid' } },
      behavior: { toggleIfOpen: true },
    }));
    const guard = onlyGuardAt(code);
    const toggle = code.indexOf('getSelectedPane');
    const related = code.indexOf('getAttribute("primarycontactid")');
    expect(code.slice(guard, toggle)).toContain(ALERT);
    expect(guard).toBeLessThan(toggle);
    expect(toggle).toBeLessThan(related);
    expect(code).not.toContain(WARN);
  });

  it('places one warning guard before the related-record read when the trigger is not a command', () => {
    const code = generateBasicScript(cfg({
      pane: { paneId: 'p' },
      trigger: { kind: 'FormOnLoad', namespace: 'TestNs', functionName: 'open' },
      host: { entityName: 'account' }, context: { source: { kind: 'lookup', attribute: 'primarycontactid' } },
      behavior: { toggleIfOpen: true },
    }));
    const guard = onlyGuardAt(code);
    expect(code.slice(guard)).toContain(WARN);
    expect(code).not.toContain(ALERT);
    expect(code).not.toContain('getSelectedPane');
    expect(guard).toBeLessThan(code.indexOf('getAttribute("primarycontactid")'));
  });

  it('emits the lookup guard once, immediately before the event is read or cancelled', () => {
    for (const generate of [generateBasicScript, generateLibraryScript]) {
      const code = generate(cfg({
        pane: { paneId: 'p' },
        trigger: { kind: 'LookupTagClick', namespace: 'TestNs', functionName: 'open' },
        host: { lookupControls: ['parentcustomerid'] },
        context: { source: { kind: 'clickedTag' } },
        behavior: { toggleIfOpen: true },
      }));
      const guard = onlyGuardAt(code);
      const cancel = code.indexOf('eventArgs.preventDefault()');
      expect(code.slice(guard, cancel)).toBe(
        'if (!Xrm.App || !Xrm.App.sidePanes) { console.warn("Side panes are not available in this client."); return; }\n' +
        '  var eventArgs = executionContext.getEventArgs();\n  '
      );
      expect(code).not.toContain(ALERT);
    }
  });

  it('leaves non-lookup library output without an availability guard', () => {
    const code = generateLibraryScript(cfg({
      trigger: { kind: 'FormButton', namespace: 'TestNs', functionName: 'open' },
      behavior: { toggleIfOpen: true },
    }));
    expect(code).not.toContain(GUARD);
  });
});

describe('close if already open (toggleIfOpen)', () => {
  function load(selected: unknown, state: number) {
    const pane = { navigate: vi.fn().mockResolvedValue(undefined), select: vi.fn() };
    const xrm = { App: { sidePanes: {
      state,
      getSelectedPane: vi.fn().mockReturnValue(selected),
      getPane: vi.fn().mockReturnValue(pane),
      createPane: vi.fn(),
      getAllPanes: vi.fn().mockReturnValue([]),
    } }, Navigation: { openErrorDialog: vi.fn(), openAlertDialog: vi.fn() } };
    const config = cfg({ pane: { paneId: 'p' }, trigger: { kind: 'FormButton', namespace: 'TestNs', functionName: 'open' },
      context: { source: { kind: 'none' } }, behavior: { toggleIfOpen: true } });
    const open = new Function('window', 'Xrm', `${generateBasicScript(config)}
return TestNs.open;`)({}, xrm) as (arg: unknown) => void;
    return { open, pane };
  }

  it('closes the pane instead of navigating when it is selected and expanded', async () => {
    const selected = { paneId: 'p', close: vi.fn() };
    const { open, pane } = load(selected, 1);
    open({});
    await vi.waitFor(() => expect(selected.close).toHaveBeenCalledOnce());
    expect(pane.navigate).not.toHaveBeenCalled();
  });

  it.each([[null, 1], [undefined, 1], [{ paneId: 'other', close: vi.fn() }, 1], [{ paneId: 'p', close: vi.fn() }, 0]])(
    'opens as usual for selected pane %o and state %i', async (selected, state) => {
      const { open, pane } = load(selected, state);
      open({});
      await vi.waitFor(() => expect(pane.navigate).toHaveBeenCalled());
    });

  it('is emitted for command-bar triggers only, in both outputs', () => {
    expect(generateLibraryScript(cfg({ behavior: { toggleIfOpen: true } }))).toContain('toggleIfOpen: true');
    expect(generateBasicScript(cfg({ trigger: { kind: 'FormOnLoad' }, behavior: { toggleIfOpen: true } }))).not.toContain('getSelectedPane');
    expect(generateLibraryScript(cfg({ trigger: { kind: 'FormOnLoad' }, behavior: { toggleIfOpen: true } }))).not.toContain('toggleIfOpen');
  });
});

describe('form-event record and pre-fill expressions', () => {
  type FormEvent = 'FormOnLoad' | 'FormOnChange';
  const recordConfig = (kind: FormEvent) => cfg({
    pane: { paneId: 'p' },
    trigger: { kind, namespace: 'TestNs', functionName: 'open' },
    host: { entityName: 'account', attribute: 'name' },
    target: { pageType: 'entityrecord', entityName: 'account', formId: '', tabName: '', data: '' },
    context: { source: { kind: 'host' } },
  });
  const prefillConfig = (kind: FormEvent) => cfg({
    pane: { paneId: 'p' },
    trigger: { kind, namespace: 'TestNs', functionName: 'open' },
    host: { entityName: 'account', attribute: 'name' },
    target: { pageType: 'entityrecord', entityName: 'contact', formId: '', tabName: '', data: '', createNew: true },
    context: { source: { kind: 'host' } },
  });
  const BASIC_RECORD = 'var recordId = formContext.data.entity.getId();';
  const LIBRARY_RECORD = 'var recordId = executionContext.getFormContext().data.entity.getId();';
  const BASIC_PREFILL = 'createFromEntity: { entityType: formContext.data.entity.getEntityName(), id: formContext.data.entity.getId() }';
  const LIBRARY_PREFILL = 'createFromEntity: { entityType: executionContext.getFormContext().data.entity.getEntityName(), id: executionContext.getFormContext().data.entity.getId() }';
  const RECORD_NAV = { pageType: 'entityrecord', entityName: 'account', entityId: '{A1}' };
  const PREFILL_NAV = { pageType: 'entityrecord', entityName: 'contact', createFromEntity: { entityType: 'account', id: '{A1}' } };
  const LIBRARY_RECORD_OPEN = { paneId: 'p', title: 'Related Records', pageType: 'entityrecord', entityName: 'account', entityId: '{A1}' };
  const LIBRARY_PREFILL_OPEN = { paneId: 'p', title: 'Related Records', pageType: 'entityrecord', entityName: 'contact', createFromEntity: { entityType: 'account', id: '{A1}' } };

  function occurrences(code: string, needle: string): number {
    return code.split(needle).length - 1;
  }

  function formProbe() {
    const events: string[] = [];
    const executionContext = {
      getFormContext: () => {
        events.push('getFormContext');
        return { data: { entity: {
          getEntityName: () => { events.push('getEntityName'); return 'account'; },
          getId: () => { events.push('getId'); return '{A1}'; },
        } } };
      },
    };
    return { events, executionContext };
  }

  function loadBasic(config: PaneDefinitionConfig, events: string[]) {
    const pane = { navigate: vi.fn(async () => { events.push('navigate'); }), select: vi.fn() };
    const xrm = { App: { sidePanes: {
      getPane: vi.fn(() => { events.push('getPane'); return null; }),
      createPane: vi.fn(async () => { events.push('createPane'); return pane; }),
      getAllPanes: vi.fn(() => []),
    } }, Navigation: { openErrorDialog: vi.fn(), openAlertDialog: vi.fn() } };
    const open = new Function('window', 'Xrm', `${generateBasicScript(config)}\nreturn TestNs.open;`)({}, xrm) as (arg: unknown) => Promise<void> | void;
    return { open, pane };
  }

  function loadLibrary(config: PaneDefinitionConfig, events: string[]) {
    const open = vi.fn(() => { events.push('open'); });
    const handler = new Function('Xrm', 'SidePaneHelper', `${generateLibraryScript(config)}\nreturn TestNs.open;`)({}, { open }) as (arg: unknown) => void;
    return { handler, open };
  }

  async function withFakeTimers(run: () => Promise<void>) {
    vi.useFakeTimers();
    try {
      await run();
    } finally {
      vi.useRealTimers();
    }
  }

  it.each(['FormOnLoad', 'FormOnChange'] as const)('Basic %s reads the captured formContext for the record id', kind => {
    const code = generateBasicScript(recordConfig(kind));
    expect(isValidJS(code)).toBe(true);
    expect(occurrences(code, BASIC_RECORD)).toBe(1);
    expect(occurrences(code, 'entityId: recordId')).toBe(2);
    expect(occurrences(code, 'executionContext.getFormContext()')).toBe(2);
    expect(code).toContain('var formContext = executionContext.getFormContext();');
    expect(code).not.toContain('executionContext.getFormContext().data');
    expect(code).not.toContain('primaryControl');
    expect(code).not.toContain('selectedRecordId');
    if (kind === 'FormOnChange') {
      expect(code).toContain('clearTimeout(__spstudio_tmr_p)');
      expect(code).toContain('setTimeout(async function()');
      expect(code).toContain(', 150);');
    } else {
      expect(code).not.toContain('setTimeout');
    }
  });

  it.each(['FormOnLoad', 'FormOnChange'] as const)('Shared Library %s reads executionContext.getFormContext() once for the record id', kind => {
    const code = generateLibraryScript(recordConfig(kind));
    expect(isValidJS(code)).toBe(true);
    expect(occurrences(code, LIBRARY_RECORD)).toBe(1);
    expect(occurrences(code, 'executionContext.getFormContext()')).toBe(1);
    expect(code).not.toContain('formContext.');
    expect(code).not.toContain('setTimeout');
    expect(code).not.toContain('primaryControl');
    expect(code).not.toContain('selectedRecordId');
  });

  it.each(['FormOnLoad', 'FormOnChange'] as const)('Basic %s pre-fill reads the captured formContext once per field', kind => {
    const code = generateBasicScript(prefillConfig(kind));
    expect(isValidJS(code)).toBe(true);
    expect(occurrences(code, BASIC_PREFILL)).toBe(2);
    expect(occurrences(code, 'formContext.data.entity.getEntityName()')).toBe(2);
    expect(occurrences(code, 'formContext.data.entity.getId()')).toBe(2);
    expect(occurrences(code, 'executionContext.getFormContext()')).toBe(2);
    expect(code).not.toContain('entityId');
    expect(code).not.toContain('executionContext.getFormContext().data');
    if (kind === 'FormOnChange') expect(code).toContain(', 150);');
    else expect(code).not.toContain('setTimeout');
  });

  it.each(['FormOnLoad', 'FormOnChange'] as const)('Shared Library %s pre-fill evaluates getFormContext once per createFromEntity field', kind => {
    const code = generateLibraryScript(prefillConfig(kind));
    expect(isValidJS(code)).toBe(true);
    expect(occurrences(code, LIBRARY_PREFILL)).toBe(1);
    expect(occurrences(code, 'executionContext.getFormContext()')).toBe(2);
    expect(code).not.toContain('formContext.');
    expect(code).not.toContain('entityId');
    expect(code).not.toContain('setTimeout');
    expect(code).not.toContain('primaryControl');
    expect(code).not.toContain('selectedRecordId');
  });

  it('Basic FormOnLoad evaluates the captured form once, then checks staleness after navigate', async () => {
    const { events, executionContext } = formProbe();
    const { open, pane } = loadBasic(recordConfig('FormOnLoad'), events);
    await open(executionContext);
    expect(events).toEqual(['getFormContext', 'getId', 'getPane', 'createPane', 'navigate', 'getFormContext']);
    expect(pane.navigate).toHaveBeenCalledWith(RECORD_NAV);
  });

  it('Basic FormOnChange debounces to one record read 150ms after the last call', async () => {
    await withFakeTimers(async () => {
      const { events, executionContext } = formProbe();
      const { open, pane } = loadBasic(recordConfig('FormOnChange'), events);
      open(executionContext);
      open(executionContext);
      expect(events).toEqual([]);
      await vi.advanceTimersByTimeAsync(149);
      expect(events).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(events).toEqual(['getFormContext', 'getId', 'getPane', 'createPane', 'navigate', 'getFormContext']);
      expect(pane.navigate).toHaveBeenCalledOnce();
      expect(pane.navigate).toHaveBeenCalledWith(RECORD_NAV);
    });
  });

  it('Shared Library FormOnLoad evaluates getFormContext once while building the record id', () => {
    const { events, executionContext } = formProbe();
    const { handler, open } = loadLibrary(recordConfig('FormOnLoad'), events);
    handler(executionContext);
    expect(events).toEqual(['getFormContext', 'getId', 'open']);
    expect(open).toHaveBeenCalledWith(LIBRARY_RECORD_OPEN);
  });

  it('Shared Library FormOnChange does not debounce and evaluates the record id on every call', () => {
    const { events, executionContext } = formProbe();
    const { handler, open } = loadLibrary(recordConfig('FormOnChange'), events);
    handler(executionContext);
    handler(executionContext);
    expect(events).toEqual(['getFormContext', 'getId', 'open', 'getFormContext', 'getId', 'open']);
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenNthCalledWith(1, LIBRARY_RECORD_OPEN);
    expect(open).toHaveBeenNthCalledWith(2, LIBRARY_RECORD_OPEN);
  });

  it('Basic FormOnLoad pre-fill evaluates getEntityName and getId once on the captured form', async () => {
    const { events, executionContext } = formProbe();
    const { open, pane } = loadBasic(prefillConfig('FormOnLoad'), events);
    await open(executionContext);
    expect(events).toEqual(['getFormContext', 'getPane', 'createPane', 'getEntityName', 'getId', 'navigate', 'getFormContext']);
    expect(pane.navigate).toHaveBeenCalledWith(PREFILL_NAV);
  });

  it('Basic FormOnChange pre-fill debounces to one createFromEntity read', async () => {
    await withFakeTimers(async () => {
      const { events, executionContext } = formProbe();
      const { open, pane } = loadBasic(prefillConfig('FormOnChange'), events);
      open(executionContext);
      open(executionContext);
      await vi.advanceTimersByTimeAsync(150);
      expect(events).toEqual(['getFormContext', 'getPane', 'createPane', 'getEntityName', 'getId', 'navigate', 'getFormContext']);
      expect(pane.navigate).toHaveBeenCalledOnce();
      expect(pane.navigate).toHaveBeenCalledWith(PREFILL_NAV);
    });
  });

  it('Shared Library FormOnLoad pre-fill evaluates getFormContext once per createFromEntity field', () => {
    const { events, executionContext } = formProbe();
    const { handler, open } = loadLibrary(prefillConfig('FormOnLoad'), events);
    handler(executionContext);
    expect(events).toEqual(['getFormContext', 'getEntityName', 'getFormContext', 'getId', 'open']);
    expect(open).toHaveBeenCalledWith(LIBRARY_PREFILL_OPEN);
  });

  it('Shared Library FormOnChange pre-fill does not debounce, so each call reads the form twice', () => {
    const { events, executionContext } = formProbe();
    const { handler, open } = loadLibrary(prefillConfig('FormOnChange'), events);
    handler(executionContext);
    handler(executionContext);
    expect(events).toEqual([
      'getFormContext', 'getEntityName', 'getFormContext', 'getId', 'open',
      'getFormContext', 'getEntityName', 'getFormContext', 'getId', 'open',
    ]);
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenNthCalledWith(1, LIBRARY_PREFILL_OPEN);
    expect(open).toHaveBeenNthCalledWith(2, LIBRARY_PREFILL_OPEN);
  });
});
