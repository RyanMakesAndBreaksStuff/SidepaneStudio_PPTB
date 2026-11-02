// src/types/PaneDefinitionConfig.ts

export type TriggerKind =
  | 'FormOnLoad' | 'FormButton' | 'FormOnChange' | 'LookupTagClick'
  | 'GridButton' | 'GridRowSelect'
  | 'ManualJS';
export type GridSurface = 'main' | 'subgrid';
export type PageType = 'custom' | 'entityrecord' | 'entitylist' | 'webresource' | 'dashboard' | 'search' | 'generative';
export type ViewType = '' | 'savedquery' | 'userquery';

/** Where the record the pane receives comes from. The capability table says which kinds a trigger offers. */
export type RecordSourceKind = 'none' | 'host' | 'selectedRow' | 'clickedTag' | 'fixed' | 'lookup';
export type RecordSource =
  | { kind: 'none' }
  /** The record on the triggering form. */
  | { kind: 'host' }
  /** The first selected row of the triggering grid. */
  | { kind: 'selectedRow' }
  /** The record named by the clicked lookup tag. */
  | { kind: 'clickedTag' }
  /** One record named at configuration time. entityName is read for page targets; a Table record target uses target.entityName. */
  | { kind: 'fixed'; entityName: string; id: string }
  /** The record a lookup column on the host record points to. */
  | { kind: 'lookup'; attribute: string };

export interface PaneConfig {
  paneId: string;
  title: string;
  imageSrc: string;
  canClose: boolean;
  hideHeader: boolean;
  isSelected: boolean;
  width: number;
  /** @deprecated Valid createPane option, deliberately unsupported: a hidden pane has no tab, so users cannot reach it. Kept so stored configs load; never emitted. */
  hidden: boolean;
  alwaysRender: boolean;
  keepBadgeOnSelect: boolean;
  isResizable: boolean;
  badgeValue: number;
}

export type TargetConfig =
  | { pageType: 'custom';       name: string }
  | { pageType: 'entityrecord'; entityName: string; formId: string; tabName: string; data: string;
      /** Omit entityId so the form opens in create mode. Pre-fill (createFromEntity) is implied by a host or selectedRow source. */
      createNew?: boolean }
  | { pageType: 'entitylist'; entityName: string; viewId: string; viewType: ViewType }
  | { pageType: 'webresource';  name: string }
  | { pageType: 'dashboard';    dashboardId: string; dashboardName: string }
  | { pageType: 'search';       searchText: string }
  | { pageType: 'generative';   pageId: string; data: string };

/** Targets that accept a record (entityName + recordId, entityId, or URL data). */
export const RECORD_TARGETS: readonly PageType[] = ['custom', 'entityrecord', 'webresource', 'generative'];
/** Command-bar triggers: a user clicks them, so they may expand the rail, alert, or close their own pane. */
export const COMMAND_TRIGGERS: readonly TriggerKind[] = ['FormButton', 'GridButton'];
export const GRID_TRIGGERS: readonly TriggerKind[] = ['GridButton', 'GridRowSelect'];

export interface TriggerConfig {
  kind: TriggerKind;
  functionName: string;
  namespace: string;
  /** Grid triggers only: which grid the command or row-select event belongs to. */
  surface: GridSurface;
}

/** The table and surface the trigger runs on. Empty entityName means "not chosen"; the script then reads the table at runtime. */
export interface HostConfig {
  entityName: string;
  /** Form triggers: the form the preview and Command Steps refer to. */
  formId: string;
  /** Grid triggers: the view the grid preview loads. */
  viewId: string;
  viewType: ViewType;
  /** FormOnChange: the column whose change fires the trigger. */
  attribute: string;
  /** LookupTagClick: lookup controls whose tag clicks open the pane. */
  lookupControls: string[];
}

export interface ContextConfig {
  source: RecordSource;
  /** Name of the generated `var` that holds the record ID. */
  variableName: string;
}

export interface BehaviorConfig {
  expandOnOpen: boolean;
  closeOthers: boolean;
  /** Command-bar triggers only: close the pane when it is already selected and expanded. */
  toggleIfOpen: boolean;
  /** Navigate an already-open pane instead of closing and recreating it. */
  reuseExistingPane: boolean;
}

export interface PaneDefinitionConfig {
  pane: PaneConfig;
  target: TargetConfig;
  trigger: TriggerConfig;
  host: HostConfig;
  context: ContextConfig;
  behavior: BehaviorConfig;
}

export const MIN_CONFIG_WIDTH = 300;
export const MAX_CONFIG_WIDTH = 1200;

export const DEFAULT_CONFIG: PaneDefinitionConfig = {
  pane: {
    paneId: 'relatedRecordsPane',
    title: 'Related Records',
    imageSrc: '',
    canClose: true,
    hideHeader: false,
    isSelected: true,
    width: 480,
    hidden: false,
    alwaysRender: false,
    keepBadgeOnSelect: false,
    isResizable: true,
    badgeValue: 0,
  },
  target: { pageType: 'custom', name: 'sps_SidePaneBuilderPage' },
  trigger: { kind: 'FormButton', functionName: 'openRelatedRecordsPane', namespace: 'YourNamespace', surface: 'main' },
  host: { entityName: '', formId: '', viewId: '', viewType: '', attribute: '', lookupControls: [] },
  context: { source: { kind: 'host' }, variableName: 'recordId' },
  behavior: { expandOnOpen: true, closeOthers: false, toggleIfOpen: false, reuseExistingPane: true },
};
