/**
 * SidePaneHelper runtime — the deployed counterpart of generateLibraryScript.
 *
 * Deployed as the web resource named by RUNTIME_WEB_RESOURCE_NAME
 * (`spstudio_/scripts/sidepane.runtime.js`). Built by `npm run build:runtime`.
 *
 * The option shape below is the plan's contract C4. generateLibraryScript emits
 * exactly these keys; this file reads exactly these keys. Neither side adds one alone.
 */

export type SidePaneHelperPageType =
  | 'custom'
  | 'entityrecord'
  | 'entitylist'
  | 'webresource'
  | 'dashboard'
  | 'search';

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

/* eslint-disable @typescript-eslint/no-explicit-any */
type XrmLike = any;

let xrmRef: XrmLike | undefined;

/** Test seam. Production resolves `Xrm` from the host window. */
export function __setXrm(xrm: XrmLike): void {
  xrmRef = xrm;
}

function getXrm(): XrmLike {
  return xrmRef ?? (globalThis as any).Xrm;
}

/** Contract C3 — the ten documented createPane paneOptions, and nothing else. */
function buildPaneOptions(o: SidePaneHelperOptions): Record<string, unknown> {
  const opts: Record<string, unknown> = { paneId: o.paneId };
  if (o.title !== undefined) opts.title = o.title;
  if (o.width !== undefined) opts.width = o.width;
  if (o.canClose !== undefined) opts.canClose = o.hideHeader ? false : o.canClose;
  if (o.hideHeader !== undefined) opts.hideHeader = o.hideHeader;
  if (o.isSelected !== undefined) opts.isSelected = o.isSelected;
  if (o.alwaysRender !== undefined) opts.alwaysRender = o.alwaysRender;
  if (o.keepBadgeOnSelect !== undefined) opts.keepBadgeOnSelect = o.keepBadgeOnSelect;
  if (o.imageSrc) opts.imageSrc = o.imageSrc;
  return opts;
}

function buildNavigateInput(o: SidePaneHelperOptions): Record<string, unknown> {
  const nav: Record<string, unknown> = { pageType: o.pageType };
  switch (o.pageType) {
    case 'custom':
      nav.name = o.name;
      if (o.entityName && o.recordId) {
        nav.entityName = o.entityName;
        nav.recordId = o.recordId;
      }
      break;
    case 'webresource':
      nav.webresourceName = o.webresourceName;
      if (o.data !== undefined) nav.data = o.data;
      break;
    case 'entityrecord':
      nav.entityName = o.entityName;
      if (o.entityId !== undefined) nav.entityId = o.entityId;
      break;
    case 'entitylist':
      nav.entityName = o.entityName;
      break;
    case 'dashboard':
      nav.dashboardId = o.dashboardId;
      break;
    case 'search':
      if (o.searchText) nav.searchText = o.searchText;
      break;
  }
  return nav;
}

export async function open(options: SidePaneHelperOptions): Promise<void> {
  const xrm = getXrm();
  try {
    if (!options || !options.paneId) {
      throw new Error('SidePaneHelper.open requires a paneId.');
    }

    const sidePanes = xrm.App.sidePanes;
    const navInput = buildNavigateInput(options);
    const reuse = options.reuseExistingPane !== false;

    const existing = sidePanes.getPane(options.paneId);
    if (existing) {
      if (reuse) {
        existing.select();
        await existing.navigate(navInput);
        if (options.badge) existing.badge = options.badge;
        return;
      }
      existing.close();
      await Promise.resolve();
    }

    if (options.expandOnOpen !== false && options.isSelected !== false) {
      sidePanes.state = 1;
    }

    const pane = await sidePanes.createPane(buildPaneOptions(options));
    await pane.navigate(navInput);
    if (options.badge) pane.badge = options.badge;

    if (options.closeOthers) {
      const all = sidePanes.getAllPanes() || [];
      all.forEach((p: XrmLike) => {
        if (p.paneId !== options.paneId) p.close();
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('SidePaneHelper.open', e);
    xrm?.Navigation?.openErrorDialog?.({ message });
  }
}
