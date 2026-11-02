import {
  GRID_TRIGGERS, PageType, PaneDefinitionConfig, RECORD_TARGETS, RecordSource, RecordSourceKind, TargetConfig, TriggerKind,
} from '../types/PaneDefinitionConfig';

export type HostPicker = 'form' | 'view' | 'lookup' | 'column' | null;

export interface TriggerCapabilities {
  label: string;
  desc: string;
  family: 'form' | 'grid' | 'manual';
  /** Which host surface the Configure panel asks for after the table. */
  hostPicker: HostPicker;
  /** Record sources this trigger can supply, in the order the panel offers them. */
  sources: readonly RecordSourceKind[];
  targets: readonly PageType[];
  gridPreview: boolean;
}

const ALL_TARGETS: readonly PageType[] = ['custom', 'generative', 'entityrecord', 'entitylist', 'webresource', 'dashboard', 'search'];
const NO_LIST: readonly PageType[] = ALL_TARGETS.filter(t => t !== 'entitylist');
const FORM_SOURCES: readonly RecordSourceKind[] = ['host', 'lookup', 'fixed', 'none'];
const GRID_SOURCES: readonly RecordSourceKind[] = ['selectedRow', 'lookup', 'fixed', 'none'];

/** The one owner of "what is legal after this trigger". Panel, validator, generator and preview all read it. */
export const TRIGGER_CAPABILITIES: Record<TriggerKind, TriggerCapabilities> = {
  FormOnLoad:     { label: 'Form on load',     desc: 'Opens when a record form loads',                               family: 'form',   hostPicker: 'form',   sources: FORM_SOURCES,   targets: ALL_TARGETS, gridPreview: false },
  FormButton:     { label: 'Form button',      desc: 'Wired to a button in the form command bar',                    family: 'form',   hostPicker: 'form',   sources: FORM_SOURCES,   targets: ALL_TARGETS, gridPreview: false },
  FormOnChange:   { label: 'Field change',     desc: 'Runs when a form column changes value',                        family: 'form',   hostPicker: 'column', sources: FORM_SOURCES,   targets: ALL_TARGETS, gridPreview: false },
  LookupTagClick: { label: 'Lookup tag click', desc: 'Opens when a tag is clicked in a lookup control',              family: 'form',   hostPicker: 'lookup', sources: ['clickedTag'], targets: ALL_TARGETS, gridPreview: false },
  GridButton:     { label: 'Grid button',      desc: 'Wired to a command bar button on a main grid or subgrid',      family: 'grid',   hostPicker: 'view',   sources: GRID_SOURCES,   targets: NO_LIST,     gridPreview: true },
  GridRowSelect:  { label: 'Grid row select',  desc: 'Opens when a single row is selected (Power Apps grid control)', family: 'grid',   hostPicker: 'view',   sources: GRID_SOURCES,   targets: NO_LIST,     gridPreview: true },
  ManualJS:       { label: 'Console',          desc: 'Paste into the browser console (F12)',                         family: 'manual', hostPicker: null,     sources: ['fixed', 'none'], targets: ALL_TARGETS, gridPreview: false },
};

export const TRIGGER_KINDS = Object.keys(TRIGGER_CAPABILITIES) as TriggerKind[];
export const SOURCE_KINDS: readonly RecordSourceKind[] = ['none', 'host', 'selectedRow', 'clickedTag', 'fixed', 'lookup'];

export function allowedTargets(kind: TriggerKind): readonly PageType[] {
  return TRIGGER_CAPABILITIES[kind].targets;
}

/** Sources the panel offers for this trigger *and* this target. */
export function allowedSources(config: Pick<PaneDefinitionConfig, 'trigger' | 'target'>): readonly RecordSourceKind[] {
  const { sources } = TRIGGER_CAPABILITIES[config.trigger.kind];
  const { target } = config;
  if (!RECORD_TARGETS.includes(target.pageType)) return ['none'];
  if (target.pageType === 'entityrecord') {
    if (target.createNew) return [...sources.filter(s => s === 'host' || s === 'selectedRow'), 'none'];
    return sources.filter(s => s !== 'none');
  }
  return sources;
}

export function defaultSource(kind: RecordSourceKind): RecordSource {
  switch (kind) {
    case 'fixed':  return { kind, entityName: '', id: '' };
    case 'lookup': return { kind, attribute: '' };
    default:       return { kind };
  }
}

export function resetTarget(pageType: PageType): TargetConfig {
  switch (pageType) {
    case 'custom':       return { pageType, name: '' };
    case 'entityrecord': return { pageType, entityName: '', formId: '', tabName: '', data: '', createNew: false };
    case 'entitylist':   return { pageType, entityName: '', viewId: '', viewType: '' };
    case 'webresource':  return { pageType, name: '' };
    case 'dashboard':    return { pageType, dashboardId: '', dashboardName: '' };
    case 'search':       return { pageType, searchText: '' };
    case 'generative':   return { pageType, pageId: '', data: '' };
  }
}

/** The table a Table record target opens; '' when it is only known at runtime (lookup, clicked tag) or not chosen. */
export function destinationTable(config: PaneDefinitionConfig): string {
  if (config.target.pageType !== 'entityrecord') return '';
  const { kind } = config.context.source;
  if (!config.target.createNew && (kind === 'host' || kind === 'selectedRow')) return config.host.entityName;
  return config.target.entityName;
}

/** Snaps target, source and derived destination to legal values. Returns the input object when nothing changes. */
export function coerceConfig(config: PaneDefinitionConfig): PaneDefinitionConfig {
  let next = config;
  const targets = allowedTargets(next.trigger.kind);
  if (!targets.includes(next.target.pageType)) next = { ...next, target: resetTarget(targets[0]) };

  const sources = allowedSources(next);
  if (!sources.includes(next.context.source.kind)) {
    next = { ...next, context: { ...next.context, source: defaultSource(sources[0]) } };
  }

  const derived = destinationTable(next);
  if (next.target.pageType === 'entityrecord' && !next.target.createNew &&
      (next.context.source.kind === 'host' || next.context.source.kind === 'selectedRow') &&
      next.target.entityName !== derived) {
    // Form data names columns of the previous table; a first derivation keeps data written before the table was known.
    const data = next.target.entityName ? '' : next.target.data;
    next = { ...next, target: { ...next.target, entityName: derived, formId: '', tabName: '', data } };
  }
  return next;
}

/** True for triggers whose script reads a grid row. */
export function isGridTrigger(kind: TriggerKind): boolean {
  return GRID_TRIGGERS.includes(kind);
}
