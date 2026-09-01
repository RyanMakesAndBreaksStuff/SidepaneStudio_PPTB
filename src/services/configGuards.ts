// src/services/configGuards.ts
import {
  PaneDefinitionConfig,
  DEFAULT_CONFIG,
  PageType,
  TriggerKind,
  ContextMode,
} from '../types/PaneDefinitionConfig';

const PAGE_TYPES: PageType[] = ['custom', 'entityrecord', 'entitylist', 'webresource', 'dashboard', 'search'];
const TRIGGER_KINDS: TriggerKind[] = ['FormOnLoad', 'FormButton', 'MainGridButton', 'SubgridButton', 'ManualJS', 'FormOnChange'];
const CONTEXT_MODES: ContextMode[] = ['CurrentRecord', 'SelectedRow', 'Static', 'None'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  // Sections added after a config was stored are back-filled from defaults.
  return {
    pane: { ...DEFAULT_CONFIG.pane, ...(isRecord(parsed.pane) ? parsed.pane : {}) },
    target: target as PaneDefinitionConfig['target'],
    trigger: { ...DEFAULT_CONFIG.trigger, ...trigger } as PaneDefinitionConfig['trigger'],
    context: { ...DEFAULT_CONFIG.context, ...(isRecord(context) ? context : {}) },
    behavior: { ...DEFAULT_CONFIG.behavior, ...(isRecord(parsed.behavior) ? parsed.behavior : {}) },
  };
}
