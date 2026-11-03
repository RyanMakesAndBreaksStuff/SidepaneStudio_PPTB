// src/services/configGuards.ts
import {
  PaneDefinitionConfig,
  DEFAULT_CONFIG,
  MIN_CONFIG_WIDTH,
  MAX_CONFIG_WIDTH,
  PageType,
  GRID_TRIGGERS, GridSurface, HostConfig, RecordSource, RecordSourceKind, TriggerKind, ViewType,
} from '../types/PaneDefinitionConfig';
import { coerceConfig, SOURCE_KINDS, TRIGGER_KINDS } from './triggerCapabilities';

export { TRIGGER_KINDS };

const PAGE_TYPES: PageType[] = ['custom', 'entityrecord', 'entitylist', 'webresource', 'dashboard', 'search', 'generative'];
const LEGACY_TRIGGERS: Record<string, { kind: TriggerKind; surface: GridSurface }> = {
  MainGridButton: { kind: 'GridButton', surface: 'main' },
  SubgridButton: { kind: 'GridButton', surface: 'subgrid' },
  MainGridOnSelect: { kind: 'GridRowSelect', surface: 'main' },
  SubgridOnSelect: { kind: 'GridRowSelect', surface: 'subgrid' },
};
const LEGACY_MODES = ['CurrentRecord', 'SelectedRow', 'Static', 'RelatedRecord', 'None'];
const VIEW_TYPES: ViewType[] = ['', 'savedquery', 'userquery'];
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RESERVED_WORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in',
  'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
  'var', 'void', 'while', 'with', 'yield', 'implements', 'interface', 'let', 'package', 'private',
  'protected', 'public', 'static',
]);

/** A name the generated script may declare with `var`. */
export function isJsIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value) && !RESERVED_WORDS.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeConfigWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CONFIG.pane.width;
  return Math.min(MAX_CONFIG_WIDTH, Math.max(MIN_CONFIG_WIDTH, value));
}

export function isConfigWidthValid(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    value >= MIN_CONFIG_WIDTH && value <= MAX_CONFIG_WIDTH;
}

/** Lookup tag click accepts several lookup controls as a comma-separated list. */
export function parseLookupFieldNames(value: string): string[] {
  return [...new Set(value.split(',').map(name => name.trim()).filter(Boolean))];
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : [];
}

/**
 * W20 — the org a stored config was saved for; the workbench writes it alongside the config fields, which
 * parseStoredConfig ignores. A legacy payload or an unusable value is an unknown org, never a mismatch.
 */
export function parseStoredOrgKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) && typeof parsed.orgKey === 'string' && parsed.orgKey ? parsed.orgKey : null;
  } catch {
    return null;
  }
}

/**
 * Parse a config previously written to toolboxAPI settings. Settings are an untrusted
 * input: they survive tool upgrades, can be hand-edited, and a wrong-shaped object
 * reaching React state crashes the whole tree. Returns null when the value cannot be
 * trusted; callers fall back to DEFAULT_CONFIG.
 */
export function parseStoredConfig(raw: unknown): PaneDefinitionConfig | null {
  if (typeof raw !== 'string' || !raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  // Discriminants control navigation; unknown values cannot be trusted.
  const target = parsed.target;
  if (!isRecord(target) || !PAGE_TYPES.includes(target.pageType as PageType)) return null;

  const trigger = parsed.trigger;
  if (!isRecord(trigger)) return null;
  const rawKind = trigger.kind;
  let kind: TriggerKind;
  let surface: GridSurface = trigger.surface === 'subgrid' ? 'subgrid' : 'main';
  if (TRIGGER_KINDS.includes(rawKind as TriggerKind)) kind = rawKind as TriggerKind;
  else if (typeof rawKind === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_TRIGGERS, rawKind)) ({ kind, surface } = LEGACY_TRIGGERS[rawKind]);
  else return null;

  const pane = isRecord(parsed.pane) ? parsed.pane : {};
  const contextRecord = isRecord(parsed.context) ? parsed.context : {};
  const behavior = isRecord(parsed.behavior) ? parsed.behavior : {};
  const hostRecord = isRecord(parsed.host) ? parsed.host : null;

  let normalizedTarget: PaneDefinitionConfig['target'];
  let legacyPrefill = false;
  if (target.pageType === 'entityrecord' || target.pageType === 'entitylist') {
    if (typeof target.entityName !== 'string') return null;
    const keys = target.pageType === 'entityrecord'
      ? ['formId', 'tabName', 'data', 'entityId'] : ['viewId', 'viewType'];
    if (keys.some(key => target[key] !== undefined && typeof target[key] !== 'string')) return null;
    if (target.pageType === 'entityrecord') {
      legacyPrefill = booleanOr(target.createFromCurrent, false);
      normalizedTarget = {
        pageType: 'entityrecord', entityName: target.entityName,
        formId: (target.formId as string | undefined) ?? '',
        tabName: (target.tabName as string | undefined) ?? '',
        data: (target.data as string | undefined) ?? '',
        createNew: booleanOr(target.createNew, false),
      };
    } else {
      if (target.viewType !== undefined && !['', 'savedquery', 'userquery'].includes(target.viewType as string)) return null;
      normalizedTarget = {
        pageType: 'entitylist', entityName: target.entityName,
        viewId: (target.viewId as string | undefined) ?? '',
        viewType: (target.viewType as '' | 'savedquery' | 'userquery' | undefined) ?? '',
      };
    }
  } else if (target.pageType === 'custom') {
    normalizedTarget = { pageType: 'custom', name: stringOr(target.name, '') };
  } else if (target.pageType === 'webresource') {
    normalizedTarget = { pageType: 'webresource', name: stringOr(target.name, '') };
  } else if (target.pageType === 'dashboard') {
    normalizedTarget = {
      pageType: 'dashboard',
      dashboardId: stringOr(target.dashboardId, ''),
      dashboardName: stringOr(target.dashboardName, ''),
    };
  } else if (target.pageType === 'generative') {
    normalizedTarget = { pageType: 'generative', pageId: stringOr(target.pageId, ''), data: stringOr(target.data, '') };
  } else {
    normalizedTarget = { pageType: 'search', searchText: stringOr(target.searchText, '') };
  }

  const fieldName = stringOr(trigger.fieldName, '');
  const host: HostConfig = hostRecord ? {
    entityName: stringOr(hostRecord.entityName, ''),
    formId: stringOr(hostRecord.formId, ''), viewId: stringOr(hostRecord.viewId, ''),
    viewType: VIEW_TYPES.includes(hostRecord.viewType as ViewType) ? hostRecord.viewType as ViewType : '',
    attribute: stringOr(hostRecord.attribute, ''), lookupControls: stringArray(hostRecord.lookupControls),
  } : {
    entityName: stringOr(contextRecord.entityName, ''), formId: '', viewId: '', viewType: '',
    attribute: kind === 'FormOnChange' ? fieldName : '',
    lookupControls: kind === 'LookupTagClick' ? parseLookupFieldNames(fieldName) : [],
  };
  let source: RecordSource;
  const rawSource = contextRecord.source;
  if (isRecord(rawSource)) {
    if (!SOURCE_KINDS.includes(rawSource.kind as RecordSourceKind)) return null;
    const k = rawSource.kind as RecordSourceKind;
    source = k === 'fixed' ? { kind: k, entityName: stringOr(rawSource.entityName, ''), id: stringOr(rawSource.id, '') }
      : k === 'lookup' ? { kind: k, attribute: stringOr(rawSource.attribute, '') } : { kind: k };
  } else if (contextRecord.mode !== undefined) {
    if (!LEGACY_MODES.includes(contextRecord.mode as string)) return null;
    const mode = contextRecord.mode as string;
    const legacyEntity = stringOr(contextRecord.entityName, '');
    const legacyId = stringOr(contextRecord.staticRecordId, '') ||
      (target.pageType === 'entityrecord' && typeof target.entityId === 'string' ? target.entityId : '');
    const grid = GRID_TRIGGERS.includes(kind);
    if (normalizedTarget.pageType === 'entityrecord' && normalizedTarget.createNew) {
      source = legacyPrefill ? { kind: grid ? 'selectedRow' : 'host' } : { kind: 'none' };
    } else if (mode === 'RelatedRecord') source = { kind: 'lookup', attribute: stringOr(contextRecord.lookupAttribute, '') };
    else if (mode === 'Static' || (mode === 'None' && normalizedTarget.pageType === 'entityrecord' && legacyId)) source = { kind: 'fixed', entityName: legacyEntity, id: legacyId };
    else if (mode === 'None') source = { kind: 'none' };
    else if (grid) source = { kind: 'selectedRow' };
    else if (kind === 'ManualJS') source = legacyId ? { kind: 'fixed', entityName: legacyEntity, id: legacyId } : { kind: 'none' };
    else source = { kind: 'host' };
  } else source = DEFAULT_CONFIG.context.source;

  // Sections added after a config was stored are back-filled from defaults.
  return coerceConfig({
    pane: {
      paneId: stringOr(pane.paneId, DEFAULT_CONFIG.pane.paneId),
      title: stringOr(pane.title, DEFAULT_CONFIG.pane.title),
      imageSrc: stringOr(pane.imageSrc, DEFAULT_CONFIG.pane.imageSrc),
      canClose: booleanOr(pane.canClose, DEFAULT_CONFIG.pane.canClose),
      hideHeader: booleanOr(pane.hideHeader, DEFAULT_CONFIG.pane.hideHeader),
      isSelected: booleanOr(pane.isSelected, DEFAULT_CONFIG.pane.isSelected),
      width: normalizeConfigWidth(pane.width),
      hidden: booleanOr(pane.hidden, DEFAULT_CONFIG.pane.hidden),
      alwaysRender: booleanOr(pane.alwaysRender, DEFAULT_CONFIG.pane.alwaysRender),
      keepBadgeOnSelect: booleanOr(pane.keepBadgeOnSelect, DEFAULT_CONFIG.pane.keepBadgeOnSelect),
      badgeValue: finiteNumberOr(pane.badgeValue, DEFAULT_CONFIG.pane.badgeValue),
    },
    target: normalizedTarget,
    trigger: {
      kind, surface,
      namespace: stringOr(trigger.namespace, DEFAULT_CONFIG.trigger.namespace),
      functionName: stringOr(trigger.functionName, DEFAULT_CONFIG.trigger.functionName),
    },
    host,
    context: {
      source,
      variableName: stringOr(contextRecord.variableName, DEFAULT_CONFIG.context.variableName),
    },
    behavior: {
      expandOnOpen: booleanOr(behavior.expandOnOpen, DEFAULT_CONFIG.behavior.expandOnOpen),
      closeOthers: booleanOr(behavior.closeOthers, DEFAULT_CONFIG.behavior.closeOthers),
      toggleIfOpen: booleanOr(behavior.toggleIfOpen, DEFAULT_CONFIG.behavior.toggleIfOpen),
      reuseExistingPane: booleanOr(behavior.reuseExistingPane, booleanOr(contextRecord.reuseExistingPane, DEFAULT_CONFIG.behavior.reuseExistingPane)),
    },
  });
}
