import { PaneDefinitionConfig, TriggerKind } from '../types/PaneDefinitionConfig';
import { normalizeGuid } from './odataGuards';

const CMD_KINDS: TriggerKind[] = ['FormButton', 'MainGridButton', 'SubgridButton'];

/** Guard variable name — namespaced to avoid collisions with other scripts. */
const PENDING_VAR = 'window.__spstudio_pendingPanes';
/** Milliseconds a pending-panes lock is considered valid before expiring. */
const PENDING_TTL_MS = 2000;
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function safeIdentifier(value: string, fallback: string): string {
  const trimmed = value.trim();
  return IDENTIFIER_PATTERN.test(trimmed) ? trimmed : fallback;
}

function getSafeTriggerNames(config: PaneDefinitionConfig): { ns: string; fn: string } {
  return {
    ns: safeIdentifier(config.trigger.namespace || '', 'MyNamespace'),
    fn: safeIdentifier(config.trigger.functionName || '', 'openPane'),
  };
}

function buildConfiguredRecordIdExpression(config: PaneDefinitionConfig): string {
  const configuredId =
    config.context.staticRecordId ||
    (config.target.pageType === 'entityrecord' ? config.target.entityId : '');
  const normalized = normalizeGuid(configuredId);
  if (normalized) return JSON.stringify(normalized);

  return `(function() { throw new Error('A valid static record ID is required for entityrecord navigation.'); })()`;
}

function buildPaneOptions(config: PaneDefinitionConfig): string {
  const { pane } = config;
  const opts: string[] = [
    `    paneId: ${JSON.stringify(pane.paneId)}`,
    `    title: ${JSON.stringify(pane.title)}`,
    `    width: ${pane.width}`,
  ];

  // P1-CGS-E: defensively coerce canClose to false when hideHeader hides the entire header bar.
  const effectiveCanClose = pane.hideHeader ? false : pane.canClose;
  opts.push(`    canClose: ${effectiveCanClose ? 'true' : 'false'}`);

  if (!pane.isResizable) {
    opts.push(`    isResizable: false`);
  } else {
    opts.push(`    // isResizable: omitted — defaults to true`);
  }

  // P1-D-C: emit isSelected only when false (API default is true; omitting true is harmless)
  if (pane.isSelected === false) opts.push(`    isSelected: false`);
  if (pane.hideHeader) opts.push(`    hideHeader: true`);
  if (pane.alwaysRender) opts.push(`    alwaysRender: true`);
  if (pane.keepBadgeOnSelect) opts.push(`    keepBadgeOnSelect: true`);
  if (pane.imageSrc) opts.push(`    imageSrc: ${JSON.stringify(pane.imageSrc)}`);
  if (pane.badgeValue) opts.push(`    badge: ${JSON.stringify(pane.badgeValue)}`);
  return `{\n${opts.join(',\n')}\n  }`;
}

function buildNavigateInput(config: PaneDefinitionConfig): string {
  const { target, trigger, context } = config;
  switch (target.pageType) {
    case 'custom':
      return `{ pageType: ${JSON.stringify(target.pageType)}, name: ${JSON.stringify(target.name)} }`;
    case 'entityrecord': {
      let entityIdExpr: string;
      if (context.mode === 'Static' || trigger.kind === 'ManualJS') {
        entityIdExpr = buildConfiguredRecordIdExpression(config);
      } else if (trigger.kind === 'FormOnLoad' || trigger.kind === 'FormOnChange') {
        entityIdExpr = 'formContext.data.entity.getId()';
      } else if (trigger.kind === 'FormButton') {
        entityIdExpr = 'primaryControl.data.entity.getId()';
      } else if (trigger.kind === 'MainGridButton' || trigger.kind === 'SubgridButton') {
        entityIdExpr = 'selectedRecordId';
      } else {
        entityIdExpr = buildConfiguredRecordIdExpression(config);
      }
      const effectiveEntityName = context.entityName || target.entityName;
      return `{ pageType: ${JSON.stringify(target.pageType)}, entityName: ${JSON.stringify(effectiveEntityName)}, entityId: ${entityIdExpr} }`;
    }
    case 'entitylist': {
      const effectiveEntityName = context.entityName || target.entityName;
      return `{ pageType: ${JSON.stringify(target.pageType)}, entityName: ${JSON.stringify(effectiveEntityName)} }`;
    }
    case 'webresource':
      return `{ pageType: ${JSON.stringify(target.pageType)}, webresourceName: ${JSON.stringify(target.name)} }`;
    case 'dashboard':
      return `{ pageType: ${JSON.stringify(target.pageType)}, dashboardId: ${JSON.stringify(target.dashboardId)} }`;

    case 'search':
      return target.searchText
        ? `{ pageType: ${JSON.stringify(target.pageType)}, searchText: ${JSON.stringify(target.searchText)} }`
        : `{ pageType: ${JSON.stringify(target.pageType)} }`;
  }
}

function buildStateAssignment(config: PaneDefinitionConfig): string {
  const isCmd = CMD_KINDS.includes(config.trigger.kind);
  if (isCmd && config.pane.isSelected !== false && config.behavior.expandOnOpen) {
    return `  Xrm.App.sidePanes.state = 1;\n`;
  }
  return '';
}

function buildGetOrCreateBody(config: PaneDefinitionConfig, indent = '  '): string {
  const { pane, context } = config;
  const paneOpts = buildPaneOptions(config);
  const navInput = buildNavigateInput(config);
  const stateAssign = buildStateAssignment(config);
  const paneIdJson = JSON.stringify(pane.paneId);
  const reuseCheck = context.reuseExistingPane
    ? `${indent}var existing = Xrm.App.sidePanes.getPane(${paneIdJson});\n${indent}if (existing) { existing.select(); return; }\n`
    : `${indent}var existing = Xrm.App.sidePanes.getPane(${paneIdJson});\n${indent}if (existing) { existing.close(); await Promise.resolve(); }\n`;

  const closeOthersBlock = config.behavior.closeOthers
    ? `${indent}var allPanes = Xrm.App.sidePanes.getAllPanes();\n${indent}allPanes.forEach(function(p) { if (p.paneId !== ${paneIdJson}) p.close(); });\n`
    : '';

  return `${reuseCheck}${stateAssign}${indent}var pane = await Xrm.App.sidePanes.createPane(${paneOpts});\n${indent}await pane.navigate(${navInput});\n${closeOthersBlock}`;
}

function generateFormOnLoad(config: PaneDefinitionConfig): string {
  const { ns, fn } = getSafeTriggerNames(config);
  const body = buildGetOrCreateBody(config, '  ');

  return `var ${ns} = ${ns} || {};
${ns}.${fn} = async function(executionContext) {
  var formContext = executionContext.getFormContext();
  try {
${body
  .split('\n')
  .map(l => '  ' + l)
  .join('\n')}
    // Staleness guard after await
    if (executionContext.getFormContext() !== formContext) return;
  } catch(e) {
    console.error(${JSON.stringify(`${ns}.${fn}`)}, e);
  }
};`;
}

function generateFormButton(config: PaneDefinitionConfig): string {
  const { ns, fn } = getSafeTriggerNames(config);
  const body = buildGetOrCreateBody(config, '    ');
  const paneIdJson = JSON.stringify(config.pane.paneId);

  return `var ${ns} = ${ns} || {};
${PENDING_VAR} = ${PENDING_VAR} || {};
${ns}.${fn} = function(primaryControl) {
  // primaryControl is captured at invocation time; assumed stable for command bar actions.
  if (${PENDING_VAR}[${paneIdJson}] && (Date.now() - ${PENDING_VAR}[${paneIdJson}]) < ${PENDING_TTL_MS}) return;
  ${PENDING_VAR}[${paneIdJson}] = Date.now();
  (async function() {
    try {
${body
  .split('\n')
  .map(l => '    ' + l)
  .join('\n')}
    } catch(e) {
      console.error(${JSON.stringify(`${ns}.${fn}`)}, e);
    } finally {
      delete ${PENDING_VAR}[${paneIdJson}];
    }
  })();
};`;
}

function generateGridButtonScript(config: PaneDefinitionConfig): string {
  const { ns, fn } = getSafeTriggerNames(config);
  const body = buildGetOrCreateBody(config, '    ');
  const paneIdJson = JSON.stringify(config.pane.paneId);

  return `var ${ns} = ${ns} || {};
${PENDING_VAR} = ${PENDING_VAR} || {};
${ns}.${fn} = function(primaryControl) {
  var selectedRows = primaryControl.getGrid().getSelectedRows();
  if (!selectedRows || selectedRows.getLength() === 0) { return; }
  var selectedRecordId = selectedRows.get(0).getData().getEntity().getId();
  if (${PENDING_VAR}[${paneIdJson}] && (Date.now() - ${PENDING_VAR}[${paneIdJson}]) < ${PENDING_TTL_MS}) return;
  ${PENDING_VAR}[${paneIdJson}] = Date.now();
  (async function() {
    try {
${body
  .split('\n')
  .map(l => '    ' + l)
  .join('\n')}
    } catch(e) {
      console.error(${JSON.stringify(`${ns}.${fn}`)}, e);
    } finally {
      delete ${PENDING_VAR}[${paneIdJson}];
    }
  })();
};`;
}

function generateMainGridButton(config: PaneDefinitionConfig): string {
  return generateGridButtonScript(config);
}

function generateSubgridButton(config: PaneDefinitionConfig): string {
  return generateGridButtonScript(config);
}

function generateManualJS(config: PaneDefinitionConfig): string {
  const { fn } = getSafeTriggerNames(config);
  const body = buildGetOrCreateBody(config, '  ');

  return `async function ${fn}() {
  try {
${body
  .split('\n')
  .map(l => '  ' + l)
  .join('\n')}
  } catch(e) {
    console.error(${JSON.stringify(fn)}, e);
  }
}
${fn}().catch(console.error);`;
}

function generateFormOnChange(config: PaneDefinitionConfig): string {
  const { trigger, pane } = config;
  const { ns, fn } = getSafeTriggerNames(config);
  const field = trigger.fieldName || '';
  const timerVar = `__spstudio_tmr_${pane.paneId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const body = buildGetOrCreateBody(config, '    ');

  return `var ${ns} = ${ns} || {};
var ${timerVar};
${ns}.${fn} = function(executionContext) {
  // Wire in OnLoad: formContext.getAttribute(${JSON.stringify(field)}).addOnChange(${ns}.${fn});
  clearTimeout(${timerVar});
  ${timerVar} = setTimeout(async function() {
    var formContext = executionContext.getFormContext();
    try {
${body
    .split('\n')
    .map(l => '    ' + l)
    .join('\n')}
      // Staleness guard after await
      if (executionContext.getFormContext() !== formContext) return;
    } catch(e) {
      console.error(${JSON.stringify(`${ns}.${fn}`)}, e);
    }
  }, 150);
};`;
}

export function generateBasicScript(config: PaneDefinitionConfig): string {
  switch (config.trigger.kind) {
    case 'FormOnLoad':
      return generateFormOnLoad(config);
    case 'FormButton':
      return generateFormButton(config);
    case 'MainGridButton':
      return generateMainGridButton(config);
    case 'SubgridButton':
      return generateSubgridButton(config);
    case 'ManualJS':
      return generateManualJS(config);
    case 'FormOnChange':
      return generateFormOnChange(config);
    default:
      return generateFormButton(config);
  }
}

export function generateLibraryScript(config: PaneDefinitionConfig): string {
  const { pane, trigger, target, context, behavior } = config;
  const ns = safeIdentifier(trigger.namespace || '', 'MyOrg');
  const fn = safeIdentifier(trigger.functionName || '', 'openPane');

  const optLines: string[] = [
    `    paneId: ${JSON.stringify(pane.paneId)}`,
    `    title: ${JSON.stringify(pane.title)}`,
    `    pageType: ${JSON.stringify(target.pageType)}`,
  ];

  if (target.pageType === 'custom' || target.pageType === 'webresource') {
    optLines.push(`    name: ${JSON.stringify(target.name)}`);
  } else if (target.pageType === 'entityrecord' || target.pageType === 'entitylist') {
    optLines.push(`    entityName: ${JSON.stringify(target.entityName)}`);
  } else if (target.pageType === 'dashboard') {
    optLines.push(`    dashboardId: ${JSON.stringify(target.dashboardId)}`);
  } else if (target.pageType === 'search' && target.searchText) {
    optLines.push(`    searchText: ${JSON.stringify(target.searchText)}`);
  }

  if (pane.width !== 480) optLines.push(`    width: ${pane.width}`);
  if (!pane.canClose) optLines.push(`    canClose: false`);
  if (!pane.isResizable) optLines.push(`    isResizable: false`);
  if (pane.hideHeader) optLines.push(`    hideHeader: true`);
  if (pane.alwaysRender) optLines.push(`    alwaysRender: true`);
  if (!context.reuseExistingPane) optLines.push(`    reuseExistingPane: false`);
  if (!behavior.expandOnOpen) optLines.push(`    expandOnOpen: false`);
  if (behavior.closeOthers) optLines.push(`    closeOthers: true`);
  if (pane.keepBadgeOnSelect) optLines.push(`    keepBadgeOnSelect: true`);
  if (pane.imageSrc) optLines.push(`    imageSrc: ${JSON.stringify(pane.imageSrc)}`);
  if (pane.badgeValue) optLines.push(`    badge: ${JSON.stringify(pane.badgeValue)}`);

  const param = (trigger.kind === 'FormOnLoad' || trigger.kind === 'FormOnChange') ? 'executionContext'
    : trigger.kind === 'ManualJS' ? ''
    : 'primaryControl';

  return `var ${ns} = ${ns} || {};
${ns}.${fn} = function(${param}) {
  SidePaneHelper.open({
${optLines.join(',\n')}
  });
};`;
}
