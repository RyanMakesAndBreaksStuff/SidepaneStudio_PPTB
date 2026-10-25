// src/types/PaneDefinitionConfig.ts

export type TriggerKind = 'FormOnLoad' | 'FormButton' | 'MainGridButton' | 'SubgridButton' | 'MainGridOnSelect' | 'SubgridOnSelect' | 'ManualJS' | 'FormOnChange' | 'LookupTagClick';
export type PageType = 'custom' | 'entityrecord' | 'entitylist' | 'webresource' | 'dashboard' | 'search' | 'generative';
export type ContextMode = 'CurrentRecord' | 'SelectedRow' | 'Static' | 'RelatedRecord' | 'None';

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
      /** Omit entityId so the form opens in create mode. Optional so configs saved before create mode type-check; parseStoredConfig back-fills false. */
      createNew?: boolean;
      /** Create mode only: send the triggering record as createFromEntity. */
      createFromCurrent?: boolean }
  | { pageType: 'entitylist'; entityName: string; viewId: string; viewType: '' | 'savedquery' | 'userquery' }
  | { pageType: 'webresource';  name: string }
  | { pageType: 'dashboard';    dashboardId: string; dashboardName: string }
  | { pageType: 'search';       searchText: string }
  | { pageType: 'generative';   pageId: string; data: string };

/** Targets whose record context comes from the clicked lookup tag (tag.id, tag.entityType). */
export const LOOKUP_TAG_TARGETS: readonly PageType[] = ['custom', 'entityrecord', 'generative'];
/** Targets that can open the one record a RelatedRecord lookup resolves to. */
export const RELATED_RECORD_TARGETS: readonly PageType[] = ['custom', 'entityrecord', 'webresource', 'generative'];
/** Command-bar triggers: a user clicks them, so they may expand the rail, alert, or close their own pane. */
export const COMMAND_TRIGGERS: readonly TriggerKind[] = ['FormButton', 'MainGridButton', 'SubgridButton'];

export interface TriggerConfig {
  kind: TriggerKind;
  functionName: string;
  namespace: string;
  fieldName: string;
}

export interface ContextConfig {
  mode: ContextMode;
  /** Record table. In RelatedRecord mode: the source table that holds lookupAttribute. */
  entityName: string;
  staticRecordId: string;
  /** RelatedRecord only: lookup column on the source record whose value opens in the pane. */
  lookupAttribute: string;
  reuseExistingPane: boolean;
}

export interface BehaviorConfig {
  expandOnOpen: boolean;
  closeOthers: boolean;
  /** Command-bar triggers only: close the pane when it is already selected and expanded. */
  toggleIfOpen: boolean;
}

export interface PaneDefinitionConfig {
  pane: PaneConfig;
  target: TargetConfig;
  trigger: TriggerConfig;
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
  trigger: { kind: 'FormButton', functionName: 'openRelatedRecordsPane', namespace: 'YourNamespace', fieldName: '' },
  context: { mode: 'CurrentRecord', entityName: '', staticRecordId: '', lookupAttribute: '', reuseExistingPane: true },
  behavior: { expandOnOpen: true, closeOthers: false, toggleIfOpen: false },
};
