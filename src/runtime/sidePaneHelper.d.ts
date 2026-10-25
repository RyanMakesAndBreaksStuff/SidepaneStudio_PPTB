/** C4: generateLibraryScript emits these options; sidepane.runtime.js reads them. */
export type SidePaneHelperPageType =
  | 'custom' | 'entityrecord' | 'entitylist' | 'webresource' | 'dashboard' | 'search' | 'generative';

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
  pageId?: string;
  webresourceName?: string;
  entityName?: string;
  entityId?: string;
  recordId?: string;
  dashboardId?: string;
  searchText?: string;
  viewId?: string;
  viewType?: 'savedquery' | 'userquery';
  formId?: string;
  tabName?: string;
  data?: string | Record<string, unknown>;
  createFromEntity?: { entityType: string; id: string; name?: string };
  badge?: number;
  reuseExistingPane?: boolean;
  expandOnOpen?: boolean;
  closeOthers?: boolean;
}
