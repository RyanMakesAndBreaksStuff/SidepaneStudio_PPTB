// src/services/configGuards.ts
import {
  PaneDefinitionConfig,
  DEFAULT_CONFIG,
  MIN_CONFIG_WIDTH,
  MAX_CONFIG_WIDTH,
  PageType,
  TriggerKind,
  ContextMode,
} from '../types/PaneDefinitionConfig';

const PAGE_TYPES: PageType[] = ['custom', 'entityrecord', 'entitylist', 'webresource', 'dashboard', 'search'];
const TRIGGER_KINDS: TriggerKind[] = ['FormOnLoad', 'FormButton', 'MainGridButton', 'SubgridButton', 'MainGridOnSelect', 'SubgridOnSelect', 'ManualJS', 'FormOnChange'];
const CONTEXT_MODES: ContextMode[] = ['CurrentRecord', 'SelectedRow', 'Static', 'None'];

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

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

  // Discriminants decide control flow in CodeGenerationService and ConfigurePanel;
  // an unrecognized value there is unrecoverable, not merge-able.
  const target = parsed.target;
  if (!isRecord(target) || !PAGE_TYPES.includes(target.pageType as PageType)) return null;

  const trigger = parsed.trigger;
  if (!isRecord(trigger) || !TRIGGER_KINDS.includes(trigger.kind as TriggerKind)) return null;

  const context = parsed.context;
  if (isRecord(context) && context.mode !== undefined && !CONTEXT_MODES.includes(context.mode as ContextMode)) {
    return null;
  }

  const pane = isRecord(parsed.pane) ? parsed.pane : {};
  const contextRecord = isRecord(parsed.context) ? parsed.context : {};
  const behavior = isRecord(parsed.behavior) ? parsed.behavior : {};

  let normalizedTarget: PaneDefinitionConfig['target'];
  if (target.pageType === 'entityrecord' || target.pageType === 'entitylist') {
    if (typeof target.entityName !== 'string') return null;
    const keys = target.pageType === 'entityrecord'
      ? ['formId', 'tabName', 'data', 'entityId'] : ['viewId', 'viewType'];
    if (keys.some(key => target[key] !== undefined && typeof target[key] !== 'string')) return null;
    if (target.pageType === 'entityrecord') {
      normalizedTarget = {
        pageType: 'entityrecord', entityName: target.entityName,
        formId: (target.formId as string | undefined) ?? '',
        tabName: (target.tabName as string | undefined) ?? '',
        data: (target.data as string | undefined) ?? '',
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
  } else {
    normalizedTarget = { pageType: 'search', searchText: stringOr(target.searchText, '') };
  }

  const normalizedMode = (contextRecord.mode as ContextMode | undefined) ?? DEFAULT_CONFIG.context.mode;
  let normalizedStaticRecordId = stringOr(
    contextRecord.staticRecordId,
    DEFAULT_CONFIG.context.staticRecordId
  );
  if (
    target.pageType === 'entityrecord' &&
    !normalizedStaticRecordId &&
    typeof target.entityId === 'string'
  ) {
    normalizedStaticRecordId = target.entityId;
  }

  // Sections added after a config was stored are back-filled from defaults.
  return {
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
      isResizable: booleanOr(pane.isResizable, DEFAULT_CONFIG.pane.isResizable),
      badgeValue: finiteNumberOr(pane.badgeValue, DEFAULT_CONFIG.pane.badgeValue),
    },
    target: normalizedTarget,
    trigger: {
      kind: trigger.kind as TriggerKind,
      namespace: stringOr(trigger.namespace, DEFAULT_CONFIG.trigger.namespace),
      functionName: stringOr(trigger.functionName, DEFAULT_CONFIG.trigger.functionName),
      fieldName: stringOr(trigger.fieldName, DEFAULT_CONFIG.trigger.fieldName),
    },
    context: {
      mode: normalizedMode,
      entityName: stringOr(contextRecord.entityName, DEFAULT_CONFIG.context.entityName),
      staticRecordId: normalizedStaticRecordId,
      reuseExistingPane: booleanOr(contextRecord.reuseExistingPane, DEFAULT_CONFIG.context.reuseExistingPane),
    },
    behavior: {
      expandOnOpen: booleanOr(behavior.expandOnOpen, DEFAULT_CONFIG.behavior.expandOnOpen),
      closeOthers: booleanOr(behavior.closeOthers, DEFAULT_CONFIG.behavior.closeOthers),
    },
  };
}
