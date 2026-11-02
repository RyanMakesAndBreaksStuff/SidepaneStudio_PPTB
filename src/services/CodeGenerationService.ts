import { PaneDefinitionConfig, TriggerKind, DEFAULT_CONFIG, COMMAND_TRIGGERS, GRID_TRIGGERS, RECORD_TARGETS } from '../types/PaneDefinitionConfig';
import { normalizeGuid } from './odataGuards';
import { isJsIdentifier, normalizeConfigWidth } from './configGuards';

const GRID_KINDS = GRID_TRIGGERS;
const GRID_SELECT_KINDS: readonly TriggerKind[] = ['GridRowSelect'];
const INVALID_ID_EXPR = `(function() { throw new Error('A valid static record ID is required for entityrecord navigation.'); })()`;

/** Guard variable name — namespaced to avoid collisions with other scripts. */
const PENDING_VAR = 'window.__spstudio_pendingPanes';
/** Milliseconds a pending-panes lock is considered valid before expiring. */
const PENDING_TTL_MS = 2000;
/** Every identifier the generated scripts declare, receive or call; the record variable and namespace names may not shadow them. */
export const GENERATED_NAMES: ReadonlySet<string> = new Set([
  'allPanes', 'eventArgs', 'existing', 'formContext', 'pane', 'primaryControl', 'relatedAttribute',
  'relatedRecord', 'relatedSource', 'selectedEntity', 'selectedPane', 'selectedRecordId',
  'selectedRows', 'tag', 'executionContext', 'control', 'name', 'e', 'p',
  'Xrm', 'window', 'SidePaneHelper', 'console', 'JSON', 'Error', 'Promise', 'Date',
  'encodeURIComponent', 'setTimeout', 'clearTimeout', 'undefined', 'arguments',
]);

function safeIdentifier(value: string, fallback: string): string {
  const trimmed = value.trim();
  return isJsIdentifier(trimmed) && !GENERATED_NAMES.has(trimmed) ? trimmed : fallback;
}

/** WR-002 / contract C3 — official imageSrc samples use the WebResources/ relative form. */
function normalizeImageSrc(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('WebResources/') ? trimmed : `WebResources/${trimmed}`;
}

export interface TriggerNameError { field: 'trigger.namespace' | 'trigger.functionName'; message: string; }
export type TriggerNames =
  | { ok: true; segments: string[]; ns: string; fn: string }
  | { ok: false; errors: TriggerNameError[] };
type ResolvedTriggerNames = Extract<TriggerNames, { ok: true }>;

/** Emitted in place of a script when the trigger names are invalid; validation reports the reason. */
const INVALID_NAMES_SCRIPT = '// Fix the trigger namespace and function name errors to generate this script.';

/**
 * CR-001 — the one source of the names the scripts define and the UI shows. A dotted namespace is split into
 * segments; an invalid name is an error, never replaced by a fallback. At most one error per field.
 */
export function resolveTriggerNames(config: PaneDefinitionConfig): TriggerNames {
  const errors: TriggerNameError[] = [];
  const namespace = (config.trigger.namespace || '').trim();
  const segments = namespace.split('.').map(segment => segment.trim());
  const fn = (config.trigger.functionName || '').trim();
  const reservedSegment = segments.find(segment => GENERATED_NAMES.has(segment));

  if (!namespace) errors.push({ field: 'trigger.namespace', message: 'Namespace is required.' });
  else if (!segments.every(isJsIdentifier)) {
    errors.push({ field: 'trigger.namespace', message: 'Namespace must be JavaScript identifiers separated by dots, such as Contoso.Panes. Reserved words are not allowed.' });
  } else if (reservedSegment) {
    errors.push({ field: 'trigger.namespace', message: `${reservedSegment} is used by the generated script. Choose another namespace.` });
  }

  if (!fn) errors.push({ field: 'trigger.functionName', message: 'Function name is required.' });
  else if (!isJsIdentifier(fn)) {
    errors.push({ field: 'trigger.functionName', message: 'Function name must be a valid JavaScript identifier. Reserved words are not allowed.' });
  } else if (GENERATED_NAMES.has(fn)) {
    errors.push({ field: 'trigger.functionName', message: `${fn} is used by the generated script. Choose another function name.` });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, segments, ns: segments.join('.'), fn };
}

/** One line per segment: `var A = A || {};` then `A.B = A.B || {};`, so each level exists before the next is assigned. */
export function namespaceDeclaration(segments: readonly string[]): string {
  return segments
    .map((_, index) => {
      const path = segments.slice(0, index + 1).join('.');
      return `${index === 0 ? 'var ' : ''}${path} = ${path} || {};`;
    })
    .join('\n');
}

/** WR-005 — every generated catch both logs and tells the user. */
function buildCatchBody(label: string, indent: string): string {
  return (
    `${indent}console.error(${JSON.stringify(label)}, e);\n` +
    `${indent}Xrm.Navigation.openErrorDialog({ message: e.message });`
  );
}

/** Name of the generated form OnLoad function that registers the lookup tag click handler. */
export function lookupRegistrarName(functionName: string): string {
  return `register${functionName.charAt(0).toUpperCase()}${functionName.slice(1)}`;
}

/** Item 2 — registrations live on each control, so remove-then-add keeps repeat OnLoad runs from registering twice. */
function buildLookupRegistrar(ns: string, fn: string, controls: readonly string[]): string {
  const registrar = `${ns}.${lookupRegistrarName(fn)}`;
  return `
// Form OnLoad handler. Turn on "Pass execution context as first parameter". Safe to run more than once.
${registrar} = function(executionContext) {
  var formContext = executionContext.getFormContext();
  ${JSON.stringify([...controls])}.forEach(function(name) {
    var control = formContext.getControl(name);
    if (!control) { console.warn(${JSON.stringify(`${registrar}: no lookup control `)} + name); return; }
    control.removeOnLookupTagClick(${ns}.${fn});
    control.addOnLookupTagClick(${ns}.${fn});
  });
};`;
}

/** Generative pages read recordId as a bare GUID; form, grid and tag IDs arrive as {GUID}. Static IDs are already normalized literals. */
function bareGuidExpr(idExpr: string): string {
  return idExpr.startsWith('"') ? idExpr : `${idExpr}.replace(/[{}]/g, '')`;
}

function buildPaneOptions(config: PaneDefinitionConfig): string {
  const { pane } = config;
  const width = normalizeConfigWidth(pane.width);
  const opts: string[] = [
    `    paneId: ${JSON.stringify(pane.paneId)}`,
    `    title: ${JSON.stringify(pane.title)}`,
    `    width: ${width}`,
  ];

  // P1-CGS-E: defensively coerce canClose to false when hideHeader hides the entire header bar.
  const effectiveCanClose = pane.hideHeader ? false : pane.canClose;
  opts.push(`    canClose: ${effectiveCanClose ? 'true' : 'false'}`);

  // P1-D-C: emit isSelected only when false (API default is true; omitting true is harmless)
  if (pane.isSelected === false) opts.push(`    isSelected: false`);
  if (pane.hideHeader) opts.push(`    hideHeader: true`);
  if (pane.alwaysRender) opts.push(`    alwaysRender: true`);
  if (pane.keepBadgeOnSelect) opts.push(`    keepBadgeOnSelect: true`);
  const imageSrc = normalizeImageSrc(pane.imageSrc);
  if (imageSrc) opts.push(`    imageSrc: ${JSON.stringify(imageSrc)}`);
  return `{\n${opts.join(',\n')}\n  }`;
}

interface RecordContext {
  idExpr: string | null;
  /** JS expression for the record's table; null when the table is unknown. */
  entityExpr: string | null;
  /** Logical name, '' when that expression is only known at runtime, or null when no record pair is sent. */
  table: string | null;
}

/** Form object whose record identity and attributes form triggers read. */
function formObjectExpr(kind: TriggerKind, formContextExpr = 'formContext'): string | null {
  if (kind === 'FormOnLoad' || kind === 'FormOnChange') return formContextExpr;
  if (kind === 'FormButton') return 'primaryControl';
  return null;
}

function runtimeHostEntityExpr(kind: TriggerKind, formContextExpr: string): string | null {
  const form = formObjectExpr(kind, formContextExpr);
  if (form) return `${form}.data.entity.getEntityName()`;
  if (GRID_KINDS.includes(kind)) return 'selectedEntity.getEntityName()';
  return null;
}

/** Contract C3 — the single owner of record-context resolution. */
function buildRecordContext(config: PaneDefinitionConfig, formContextExpr = 'formContext'): RecordContext {
  const { context: { source }, trigger, target, host } = config;
  const none: RecordContext = { idExpr: null, entityExpr: null, table: null };
  if (!RECORD_TARGETS.includes(target.pageType)) return none;
  const kind = trigger.kind;
  const form = formObjectExpr(kind, formContextExpr);
  const hostTable = host.entityName.trim();
  const hostExpr = hostTable ? JSON.stringify(hostTable) : runtimeHostEntityExpr(kind, formContextExpr);
  switch (source.kind) {
    case 'host':        return form ? { idExpr: `${form}.data.entity.getId()`, entityExpr: hostExpr, table: hostTable } : none;
    case 'selectedRow': return GRID_KINDS.includes(kind) ? { idExpr: 'selectedRecordId', entityExpr: hostExpr, table: hostTable } : none;
    case 'clickedTag':  return kind === 'LookupTagClick' ? { idExpr: 'tag.id', entityExpr: 'tag.entityType', table: '' } : none;
    case 'lookup':      return form || GRID_KINDS.includes(kind) ? { idExpr: 'relatedRecord.id', entityExpr: 'relatedRecord.entityType', table: '' } : none;
    case 'fixed': {
      const id = normalizeGuid(source.id);
      const table = (target.pageType === 'entityrecord' ? target.entityName : source.entityName).trim();
      return { idExpr: id ? JSON.stringify(id) : INVALID_ID_EXPR, entityExpr: table ? JSON.stringify(table) : null, table: table || null };
    }
    case 'none':        return none;
  }
}

/** Table the script sends with a record: its logical name, '' when the table is only known at runtime, or null when no record is sent. */
export function recordContextTable(config: PaneDefinitionConfig): string | null {
  return buildRecordContext(config).table;
}

/** Declare the record ID once before both navigation paths use it. */
function declareRecordVariable(config: PaneDefinitionConfig, rc: RecordContext, indent: string): { line: string; rc: RecordContext } {
  const creating = config.target.pageType === 'entityrecord' && config.target.createNew === true;
  if (!rc.idExpr || creating) return { line: '', rc };
  const name = safeIdentifier(config.context.variableName, 'recordId');
  return { line: `${indent}var ${name} = ${rc.idExpr};\n`, rc: { ...rc, idExpr: name } };
}

/** Item 3 — createFromEntity copies mapped columns from the triggering record. Null when no record triggers the script. */
function buildCreateFromEntityExpr(config: PaneDefinitionConfig, formContextExpr = 'formContext'): string | null {
  const { target, trigger, context: { source }, host } = config;
  if (target.pageType !== 'entityrecord' || !target.createNew) return null;
  const form = formObjectExpr(trigger.kind, formContextExpr);
  if (source.kind === 'host' && form) return `{ entityType: ${form}.data.entity.getEntityName(), id: ${form}.data.entity.getId() }`;
  if (source.kind === 'selectedRow' && GRID_KINDS.includes(trigger.kind)) {
    const table = host.entityName.trim();
    return `{ entityType: ${table ? JSON.stringify(table) : 'selectedEntity.getEntityName()'}, id: selectedRecordId }`;
  }
  return null;
}

/**
 * RelatedRecord — declares `relatedRecord` ({ id, entityType }) from the source record's lookup,
 * or returns before any pane opens when the lookup is empty. Form triggers read the form value
 * (unsaved edits included); grid rows expose only view columns, so grids read the saved record.
 */
function buildRelatedRecordPreamble(config: PaneDefinitionConfig, indent: string, formContextExpr = 'formContext'): string {
  const { context: { source }, trigger, host } = config;
  if (source.kind !== 'lookup') return '';
  const lookup = source.attribute.trim();
  const form = formObjectExpr(trigger.kind, formContextExpr);
  if (form) {
    return (
      `${indent}var relatedAttribute = ${form}.getAttribute(${JSON.stringify(lookup)});\n` +
      `${indent}if (!relatedAttribute) throw new Error(${JSON.stringify(`The lookup column ${lookup} is not on this form.`)});\n` +
      `${indent}var relatedRecord = (relatedAttribute.getValue() || [])[0];\n` +
      `${indent}if (!relatedRecord) return;\n`
    );
  }
  if (!GRID_KINDS.includes(trigger.kind)) return '';
  const valueKey = `_${lookup}_value`;
  return (
    `${indent}var relatedSource = await Xrm.WebApi.retrieveRecord(${JSON.stringify(host.entityName.trim())}, ` +
    `selectedRecordId.replace(/[{}]/g, ''), ${JSON.stringify(`?$select=${valueKey}`)});\n` +
    `${indent}if (!relatedSource[${JSON.stringify(valueKey)}]) return;\n` +
    `${indent}var relatedRecord = { id: relatedSource[${JSON.stringify(valueKey)}], ` +
    `entityType: relatedSource[${JSON.stringify(`${valueKey}@Microsoft.Dynamics.CRM.lookuplogicalname`)}] };\n`
  );
}

function buildTargetParameterParts(
  target: PaneDefinitionConfig['target'],
  rc: RecordContext,
): string[] {
  const parts: string[] = [];
  if (target.pageType === 'entitylist' && target.viewId.trim()) {
    parts.push(`viewId: ${JSON.stringify(normalizeGuid(target.viewId) ?? target.viewId)}`);
    parts.push(`viewType: ${JSON.stringify(target.viewType)}`);
  }
  if (target.pageType === 'entityrecord') {
    const formTabParts: string[] = [];
    if (target.formId.trim()) formTabParts.push(`formId: ${JSON.stringify(normalizeGuid(target.formId) ?? target.formId)}`);
    if (target.tabName.trim()) formTabParts.push(`tabName: ${JSON.stringify(target.tabName.trim())}`);
    if (formTabParts.length && rc.table === '' && rc.entityExpr && target.entityName.trim() && !target.createNew) {
      parts.push(`...(${rc.entityExpr} === ${JSON.stringify(target.entityName)} ? { ${formTabParts.join(', ')} } : {})`);
    } else {
      parts.push(...formTabParts);
    }
  }
  if (target.pageType === 'generative') {
    parts.push(`pageId: ${JSON.stringify(normalizeGuid(target.pageId) ?? target.pageId)}`);
  }
  if ((target.pageType === 'entityrecord' || target.pageType === 'generative') && target.data.trim()) {
    parts.push(`data: JSON.parse(${JSON.stringify(target.data)})`);
  }
  return parts;
}

function buildNavigateInput(config: PaneDefinitionConfig, rc: RecordContext): string {
  const { target } = config;

  switch (target.pageType) {
    case 'custom': {
      const parts = [
        `pageType: ${JSON.stringify(target.pageType)}`,
        `name: ${JSON.stringify(target.name)}`,
      ];
      if (rc.idExpr && rc.entityExpr) {
        parts.push(`entityName: ${rc.entityExpr}`);
        parts.push(`recordId: ${rc.idExpr}`);
      }
      return `{ ${parts.join(', ')} }`;
    }
    case 'entityrecord': {
      // Create mode: no entityId, and the configured table wins over the context table.
      if (target.createNew) {
        const createFrom = buildCreateFromEntityExpr(config);
        return `{ ${[
          `pageType: ${JSON.stringify(target.pageType)}`,
          `entityName: ${JSON.stringify(target.entityName)}`,
          ...buildTargetParameterParts(target, rc),
          ...(createFrom ? [`createFromEntity: ${createFrom}`] : []),
        ].join(', ')} }`;
      }
      const entityIdExpr = rc.idExpr ?? INVALID_ID_EXPR;
      return `{ ${[
        `pageType: ${JSON.stringify(target.pageType)}`,
        `entityName: ${rc.entityExpr ?? '""'}`,
        `entityId: ${entityIdExpr}`,
        ...buildTargetParameterParts(target, rc),
      ].join(', ')} }`;
    }
    case 'entitylist':
      return `{ ${[
        `pageType: ${JSON.stringify(target.pageType)}`,
        `entityName: ${JSON.stringify(target.entityName)}`,
        ...buildTargetParameterParts(target, rc),
      ].join(', ')} }`;
    case 'webresource': {
      const parts = [
        `pageType: ${JSON.stringify(target.pageType)}`,
        `webresourceName: ${JSON.stringify(target.name)}`,
      ];
      if (rc.idExpr && rc.entityExpr) {
        parts.push(
          `data: encodeURIComponent(JSON.stringify({ entityName: ${rc.entityExpr}, recordId: ${rc.idExpr} }))`
        );
      }
      return `{ ${parts.join(', ')} }`;
    }
    case 'dashboard':
      return `{ pageType: ${JSON.stringify(target.pageType)}, dashboardId: ${JSON.stringify(target.dashboardId)} }`;
    case 'search':
      return target.searchText
        ? `{ pageType: ${JSON.stringify(target.pageType)}, searchText: ${JSON.stringify(target.searchText)} }`
        : `{ pageType: ${JSON.stringify(target.pageType)} }`;
    case 'generative': {
      const parts = [`pageType: ${JSON.stringify(target.pageType)}`, ...buildTargetParameterParts(target, rc)];
      if (rc.idExpr && rc.entityExpr) {
        parts.push(`entityName: ${rc.entityExpr}`);
        parts.push(`recordId: ${bareGuidExpr(rc.idExpr)}`);
      }
      return `{ ${parts.join(', ')} }`;
    }
  }
}

function buildStateAssignment(config: PaneDefinitionConfig): string {
  const isCmd = COMMAND_TRIGGERS.includes(config.trigger.kind);
  if (isCmd && config.pane.isSelected !== false && config.behavior.expandOnOpen) {
    return `  Xrm.App.sidePanes.state = 1;\n`;
  }
  return '';
}

/** Side panes are unavailable in on-premises deployments and native players. Load and change handlers log instead of raising a dialog on every form load. */
function buildAvailabilityGuard(config: PaneDefinitionConfig, indent: string): string {
  const message = JSON.stringify('Side panes are not available in this client.');
  const notify = COMMAND_TRIGGERS.includes(config.trigger.kind)
    ? `Xrm.Navigation.openAlertDialog({ text: ${message} });`
    : `console.warn(${message});`;
  return `${indent}if (!Xrm.App || !Xrm.App.sidePanes) { ${notify} return; }
`;
}

/** Runs after the availability guard and before any lookup read, so a closing click does no other work. */
function buildToggleIfOpen(config: PaneDefinitionConfig, indent: string): string {
  if (!config.behavior.toggleIfOpen || !COMMAND_TRIGGERS.includes(config.trigger.kind)) return '';
  return (
    `${indent}var selectedPane = Xrm.App.sidePanes.getSelectedPane();
` +
    `${indent}if (selectedPane && selectedPane.paneId === ${JSON.stringify(config.pane.paneId)} && Xrm.App.sidePanes.state === 1) { selectedPane.close(); return; }
`
  );
}

function buildGetOrCreateBody(config: PaneDefinitionConfig, indent = '  '): string {
  const { pane, behavior } = config;
  const paneOpts = buildPaneOptions(config);
  const declared = declareRecordVariable(config, buildRecordContext(config), indent);
  const navInput = buildNavigateInput(config, declared.rc);
  const stateAssign = buildStateAssignment(config);
  const paneIdJson = JSON.stringify(pane.paneId);
  const reuseCheck = behavior.reuseExistingPane
    ? `${indent}var existing = Xrm.App.sidePanes.getPane(${paneIdJson});\n${indent}if (existing) { await existing.navigate(${navInput}); existing.select(); } else {\n`
    : `${indent}var existing = Xrm.App.sidePanes.getPane(${paneIdJson});\n${indent}if (existing) { existing.close(); await Promise.resolve(); }\n`;

  const badgeAssign = pane.badgeValue
    ? `${indent}pane.badge = ${JSON.stringify(pane.badgeValue)};\n`
    : '';

  const closeOthersBlock = config.behavior.closeOthers
    ? `${indent}var allPanes = Xrm.App.sidePanes.getAllPanes();\n${indent}allPanes.forEach(function(p) { if (p.paneId !== ${paneIdJson}) p.close(); });\n`
    : '';

  const createBody = `${stateAssign}${indent}var pane = await Xrm.App.sidePanes.createPane(${paneOpts});\n${indent}await pane.navigate(${navInput});\n${badgeAssign}`;
  // Lookup handlers guard before preventDefault, so the shared body must not repeat the check.
  const availabilityGuard = config.trigger.kind === 'LookupTagClick' ? '' : buildAvailabilityGuard(config, indent);
  return `${availabilityGuard}${buildToggleIfOpen(config, indent)}${buildRelatedRecordPreamble(config, indent)}${declared.line}${reuseCheck}${createBody}${behavior.reuseExistingPane ? `${indent}}\n` : ''}${closeOthersBlock}`;
}

function generateFormOnLoad(config: PaneDefinitionConfig, { segments, ns, fn }: ResolvedTriggerNames): string {
  const body = buildGetOrCreateBody(config, '  ');

  return `${namespaceDeclaration(segments)}
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
    ${buildCatchBody(`${ns}.${fn}`, '    ')}
  }
};`;
}

function generateFormButton(config: PaneDefinitionConfig, { segments, ns, fn }: ResolvedTriggerNames): string {
  const body = buildGetOrCreateBody(config, '    ');
  const paneIdJson = JSON.stringify(config.pane.paneId);

  return `${namespaceDeclaration(segments)}
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
      ${buildCatchBody(`${ns}.${fn}`, '      ')}
    } finally {
      delete ${PENDING_VAR}[${paneIdJson}];
    }
  })();
};`;
}

function generateGridButtonScript(config: PaneDefinitionConfig, { segments, ns, fn }: ResolvedTriggerNames): string {
  const body = buildGetOrCreateBody(config, '    ');
  const paneIdJson = JSON.stringify(config.pane.paneId);
  const onSelect = GRID_SELECT_KINDS.includes(config.trigger.kind);
  const arg = onSelect ? 'executionContext' : 'primaryControl';
  // OnRecordSelect: executionContext.getEventSource().getId() — Power Apps grid control sample
  // https://learn.microsoft.com/power-apps/developer/model-driven-apps/clientapi/reference/events/grid-onrecordselect
  const rowPreamble = onSelect
    ? `  var selectedEntity = executionContext.getEventSource();\n  var selectedRecordId = selectedEntity.getId();\n`
    : `  var selectedRows = primaryControl.getGrid().getSelectedRows();\n  if (!selectedRows || selectedRows.getLength() === 0) { return; }\n  var selectedEntity = selectedRows.get(0).getData().getEntity();\n  var selectedRecordId = selectedEntity.getId();\n`;

  return `${namespaceDeclaration(segments)}
${PENDING_VAR} = ${PENDING_VAR} || {};
${ns}.${fn} = function(${arg}) {
${rowPreamble}  if (${PENDING_VAR}[${paneIdJson}] && (Date.now() - ${PENDING_VAR}[${paneIdJson}]) < ${PENDING_TTL_MS}) return;
  ${PENDING_VAR}[${paneIdJson}] = Date.now();
  (async function() {
    try {
${body
  .split('\n')
  .map(l => '    ' + l)
  .join('\n')}
    } catch(e) {
      ${buildCatchBody(`${ns}.${fn}`, '      ')}
    } finally {
      delete ${PENDING_VAR}[${paneIdJson}];
    }
  })();
};`;
}

function generateManualJS(config: PaneDefinitionConfig, { fn }: ResolvedTriggerNames): string {
  const body = buildGetOrCreateBody(config, '  ');

  return `async function ${fn}() {
  try {
${body
  .split('\n')
  .map(l => '  ' + l)
  .join('\n')}
  } catch(e) {
    ${buildCatchBody(fn, '    ')}
  }
}
${fn}().catch(console.error);`;
}

function generateFormOnChange(config: PaneDefinitionConfig, { segments, ns, fn }: ResolvedTriggerNames): string {
  const { pane } = config;
  const field = config.host.attribute || '';
  const timerVar = `__spstudio_tmr_${pane.paneId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const body = buildGetOrCreateBody(config, '    ');

  return `${namespaceDeclaration(segments)}
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
      ${buildCatchBody(`${ns}.${fn}`, '      ')}
    }
  }, 150);
};`;
}

function generateLookupTagClick(config: PaneDefinitionConfig, { segments, ns, fn }: ResolvedTriggerNames): string {
  const body = buildGetOrCreateBody(config, '  ');
  return `${namespaceDeclaration(segments)}
${ns}.${fn} = async function(executionContext) {
${buildAvailabilityGuard(config, '  ')}  var eventArgs = executionContext.getEventArgs();
  eventArgs.preventDefault();
  var tag = eventArgs.getTagValue();
  if (!tag || !tag.id) return;
  try {
${body.split('\n').map(line => '  ' + line).join('\n')}
  } catch(e) {
    ${buildCatchBody(`${ns}.${fn}`, '    ')}
  }
};${buildLookupRegistrar(ns, fn, config.host.lookupControls)}`;
}

export function generateBasicScript(config: PaneDefinitionConfig): string {
  const names = resolveTriggerNames(config);
  if (!names.ok) return INVALID_NAMES_SCRIPT;
  switch (config.trigger.kind) {
    case 'FormOnLoad':
      return generateFormOnLoad(config, names);
    case 'FormButton':
      return generateFormButton(config, names);
    case 'GridButton':
    case 'GridRowSelect':
      return generateGridButtonScript(config, names);
    case 'ManualJS':
      return generateManualJS(config, names);
    case 'FormOnChange':
      return generateFormOnChange(config, names);
    case 'LookupTagClick':
      return generateLookupTagClick(config, names);
    default:
      return generateFormButton(config, names);
  }
}

export function generateLibraryScript(config: PaneDefinitionConfig): string {
  const { pane, trigger, target, behavior } = config;
  const names = resolveTriggerNames(config);
  if (!names.ok) return INVALID_NAMES_SCRIPT;
  const { segments, ns, fn } = names;
  const width = normalizeConfigWidth(pane.width);
  const formContextExpr = trigger.kind === 'FormOnLoad' || trigger.kind === 'FormOnChange'
    ? 'executionContext.getFormContext()'
    : 'formContext';
  const declared = declareRecordVariable(config, buildRecordContext(config, formContextExpr), '  ');
  const rc = declared.rc;
  const libIdExpr = rc.idExpr;

  const optLines: string[] = [
    `    paneId: ${JSON.stringify(pane.paneId)}`,
    `    title: ${JSON.stringify(pane.title)}`,
    `    pageType: ${JSON.stringify(target.pageType)}`,
  ];

  // Target keys — contract C4. name and webresourceName are mutually exclusive (WR-007).
  if (target.pageType === 'custom') {
    optLines.push(`    name: ${JSON.stringify(target.name)}`);
    if (libIdExpr && rc.entityExpr) {
      optLines.push(`    entityName: ${rc.entityExpr}`);
      optLines.push(`    recordId: ${libIdExpr}`);
    }
  } else if (target.pageType === 'webresource') {
    optLines.push(`    webresourceName: ${JSON.stringify(target.name)}`);
    if (libIdExpr && rc.entityExpr) {
      optLines.push(
        `    data: encodeURIComponent(JSON.stringify({ entityName: ${rc.entityExpr}, recordId: ${libIdExpr} }))`
      );
    }
  } else if (target.pageType === 'entityrecord') {
    if (target.createNew) {
      optLines.push(`    entityName: ${JSON.stringify(target.entityName)}`);
      const createFrom = buildCreateFromEntityExpr(config, formContextExpr);
      if (createFrom) optLines.push(`    createFromEntity: ${createFrom}`);
    } else {
      optLines.push(`    entityName: ${rc.entityExpr ?? '""'}`);
      optLines.push(`    entityId: ${libIdExpr ?? INVALID_ID_EXPR}`);
    }
  } else if (target.pageType === 'entitylist') {
    optLines.push(`    entityName: ${JSON.stringify(target.entityName)}`);
  } else if (target.pageType === 'dashboard') {
    optLines.push(`    dashboardId: ${JSON.stringify(target.dashboardId)}`);
  } else if (target.pageType === 'search' && target.searchText) {
    optLines.push(`    searchText: ${JSON.stringify(target.searchText)}`);
  } else if (target.pageType === 'generative' && libIdExpr && rc.entityExpr) {
    optLines.push(`    entityName: ${rc.entityExpr}`);
    optLines.push(`    recordId: ${bareGuidExpr(libIdExpr)}`);
  }

  optLines.push(...buildTargetParameterParts(target, rc).map(part => `    ${part}`));

  // Appearance + behavior keys — contract C4. isResizable is deliberately absent.
  if (width !== DEFAULT_CONFIG.pane.width) optLines.push(`    width: ${width}`);
  if (!pane.canClose) optLines.push(`    canClose: false`);
  if (pane.hideHeader) optLines.push(`    hideHeader: true`);
  if (pane.isSelected === false) optLines.push(`    isSelected: false`);
  if (pane.alwaysRender) optLines.push(`    alwaysRender: true`);
  if (pane.keepBadgeOnSelect) optLines.push(`    keepBadgeOnSelect: true`);
  const imageSrc = normalizeImageSrc(pane.imageSrc);
  if (imageSrc) optLines.push(`    imageSrc: ${JSON.stringify(imageSrc)}`);
  if (pane.badgeValue) optLines.push(`    badge: ${JSON.stringify(pane.badgeValue)}`);
  if (!behavior.reuseExistingPane) optLines.push(`    reuseExistingPane: false`);
  if (!behavior.expandOnOpen) optLines.push(`    expandOnOpen: false`);
  if (behavior.closeOthers) optLines.push(`    closeOthers: true`);
  if (behavior.toggleIfOpen && COMMAND_TRIGGERS.includes(trigger.kind)) optLines.push(`    toggleIfOpen: true`);

  const param =
    trigger.kind === 'FormOnLoad' || trigger.kind === 'FormOnChange' || trigger.kind === 'LookupTagClick' || GRID_SELECT_KINDS.includes(trigger.kind)
      ? 'executionContext'
      : trigger.kind === 'ManualJS'
        ? ''
        : 'primaryControl';

  const gridContext = GRID_SELECT_KINDS.includes(trigger.kind)
    ? `  var selectedEntity = executionContext.getEventSource();\n  var selectedRecordId = selectedEntity.getId();\n`
    : trigger.kind === 'GridButton'
      ? `  var selectedRows = primaryControl.getGrid().getSelectedRows();\n  if (!selectedRows || selectedRows.getLength() === 0) { return; }\n  var selectedEntity = selectedRows.get(0).getData().getEntity();\n  var selectedRecordId = selectedEntity.getId();\n`
      : '';

  const lookupPreamble = trigger.kind === 'LookupTagClick'
    ? `${buildAvailabilityGuard(config, '  ')}  var eventArgs = executionContext.getEventArgs();\n  eventArgs.preventDefault();\n  var tag = eventArgs.getTagValue();\n  if (!tag || !tag.id) return;\n`
    : '';

  const lookupRegistration = trigger.kind === 'LookupTagClick' ? buildLookupRegistrar(ns, fn, config.host.lookupControls) : '';

  const openCall = `  SidePaneHelper.open({\n${optLines.join(',\n')}\n  });\n`;
  const relatedPreamble = buildRelatedRecordPreamble(config, '      ', formContextExpr);
  // Lookup resolution awaits the lookup, so the open call and record variable share its async scope.
  const body = relatedPreamble
    ? `  (async function() {\n    try {\n${relatedPreamble}${declared.line.replace(/^ {2}/, '      ')}${openCall.replace(/^(?=.)/gm, '    ')}` +
      `    } catch(e) {\n${buildCatchBody(`${ns}.${fn}`, '      ')}\n    }\n  })();\n`
    : `${declared.line}${openCall}`;

  return `${namespaceDeclaration(segments)}
${ns}.${fn} = function(${param}) {
${lookupPreamble}${gridContext}${body}};${lookupRegistration}`;
}
