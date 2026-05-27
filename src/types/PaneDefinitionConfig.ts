// src/types/PaneDefinitionConfig.ts

export type TriggerKind = 'FormOnLoad' | 'FormButton' | 'MainGridButton' | 'SubgridButton' | 'ManualJS' | 'FormOnChange';
export type PageType = 'custom' | 'entityrecord' | 'entitylist' | 'webresource' | 'dashboard' | 'search';
export type ContextMode = 'CurrentRecord' | 'SelectedRow' | 'Static' | 'None';

export interface PaneConfig {
  paneId: string;
  title: string;
  imageSrc: string;
  canClose: boolean;
  hideHeader: boolean;
  isSelected: boolean;
  width: number;
  /** @deprecated Never consumed by any consumer. Preserved for backward compatibility with stored configs. */
  hidden: boolean;
  alwaysRender: boolean;
  keepBadgeOnSelect: boolean;
  isResizable: boolean;
  badgeValue: number;
}

export type TargetConfig =
  | { pageType: 'custom';       name: string }
  | { pageType: 'entityrecord'; entityName: string; entityId: string }
  | { pageType: 'entitylist';   entityName: string }
  | { pageType: 'webresource';  name: string }
  | { pageType: 'dashboard';    dashboardId: string; dashboardName: string }
  | { pageType: 'search';       searchText: string };

export interface TriggerConfig {
  kind: TriggerKind;
  functionName: string;
  namespace: string;
  fieldName: string;
}

export interface ContextConfig {
  mode: ContextMode;
  entityName: string;
  staticRecordId: string;
  reuseExistingPane: boolean;
}

export interface BehaviorConfig {
  expandOnOpen: boolean;
  closeOthers: boolean;
}

export interface PaneDefinitionConfig {
  pane: PaneConfig;
  target: TargetConfig;
  trigger: TriggerConfig;
  context: ContextConfig;
  behavior: BehaviorConfig;
}

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
  target: { pageType: 'custom', name: 'cpp_SidePaneBuilderPage' },
  trigger: { kind: 'FormButton', functionName: 'openRelatedRecordsPane', namespace: 'Contoso', fieldName: '' },
  context: { mode: 'CurrentRecord', entityName: '', staticRecordId: '', reuseExistingPane: true },
  behavior: { expandOnOpen: true, closeOthers: false },
};
