/** C4: generateLibraryScript emits these options; sidepane.runtime.js reads them. */
export type SidePaneHelperPageType =
  | 'custom' | 'entityrecord' | 'entitylist' | 'webresource' | 'dashboard' | 'search';

export interface SidePaneHelperOptions {
  paneId: string;
  title?: string;
  width?: number;
  canClose?: boolean;
  hideHeader?: boolean;
  isSelected?: boolean;
  alwaysRender?: boolean;
  keepBadgeOnSelect?: boolean;
  imageSrc?: string;
  pageType: SidePaneHelperPageType;
  name?: string;
  webresourceName?: string;
  entityName?: string;
  entityId?: string;
  recordId?: string;
  dashboardId?: string;
  searchText?: string;
  data?: string;
  badge?: number;
  reuseExistingPane?: boolean;
  expandOnOpen?: boolean;
  closeOthers?: boolean;
}
