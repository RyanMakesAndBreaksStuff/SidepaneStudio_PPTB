/** Downloaded verbatim. C4 options are declared in sidePaneHelper.d.ts. */
(function () {
  'use strict';

  function buildPaneOptions(o) {
    const opts = { paneId: o.paneId };
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

  function buildNavigateInput(o) {
    const nav = { pageType: o.pageType };
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
        if (o.formId) nav.formId = o.formId;
        if (o.tabName) nav.tabName = o.tabName;
        if (o.data !== undefined) nav.data = o.data;
        break;
      case 'entitylist':
        nav.entityName = o.entityName;
        if (o.viewId) {
          nav.viewId = o.viewId;
          nav.viewType = o.viewType;
        }
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

  async function open(options) {
    const xrm = globalThis.Xrm;
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
        all.forEach(p => {
          if (p.paneId !== options.paneId) p.close();
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('SidePaneHelper.open', e);
      if (xrm && xrm.Navigation && xrm.Navigation.openErrorDialog) {
        xrm.Navigation.openErrorDialog({ message });
      }
    }
  }

  globalThis.SidePaneHelper = { open };
})();
