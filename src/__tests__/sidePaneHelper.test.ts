import { describe, it, expect, vi, beforeEach } from 'vitest';
import { open, __setXrm } from '../runtime/sidePaneHelper';

function fakeXrm() {
  const pane = { paneId: 'p', select: vi.fn(), close: vi.fn(), navigate: vi.fn().mockResolvedValue(undefined), badge: 0 };
  const sidePanes = {
    state: 0,
    createPane: vi.fn().mockResolvedValue(pane),
    getPane: vi.fn().mockReturnValue(undefined),
    getAllPanes: vi.fn().mockReturnValue([]),
  };
  return { pane, xrm: { App: { sidePanes }, Navigation: { openErrorDialog: vi.fn() } } };
}

describe('SidePaneHelper.open — createPane options (contract C4/C3)', () => {
  let f: ReturnType<typeof fakeXrm>;
  beforeEach(() => { f = fakeXrm(); __setXrm(f.xrm as any); });

  it('forwards only documented paneOptions to createPane', async () => {
    await open({ paneId: 'p', title: 'T', width: 600, pageType: 'custom', name: 'sps_Page', badge: 3, closeOthers: true });
    const opts = f.xrm.App.sidePanes.createPane.mock.calls[0][0];
    expect(Object.keys(opts).sort()).toEqual(['paneId', 'title', 'width']);
    expect(opts).not.toHaveProperty('badge');
    expect(opts).not.toHaveProperty('isResizable');
  });

  it('navigates a custom page with entityName and recordId', async () => {
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page', entityName: 'account', recordId: 'g1' });
    expect(f.pane.navigate).toHaveBeenCalledWith({ pageType: 'custom', name: 'sps_Page', entityName: 'account', recordId: 'g1' });
  });

  it('navigates a web resource with webresourceName and data', async () => {
    await open({ paneId: 'p', pageType: 'webresource', webresourceName: 'new_p.html', data: 'abc' });
    expect(f.pane.navigate).toHaveBeenCalledWith({ pageType: 'webresource', webresourceName: 'new_p.html', data: 'abc' });
  });

  it('sets badge on the pane after navigate, never inside createPane', async () => {
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page', badge: 7 });
    expect(f.pane.badge).toBe(7);
  });

  it('reuses an existing pane by selecting AND navigating it', async () => {
    f.xrm.App.sidePanes.getPane.mockReturnValue(f.pane);
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page', reuseExistingPane: true });
    expect(f.pane.select).toHaveBeenCalled();
    expect(f.pane.navigate).toHaveBeenCalled();
    expect(f.xrm.App.sidePanes.createPane).not.toHaveBeenCalled();
  });

  it('closes an existing pane when reuse is disabled', async () => {
    f.xrm.App.sidePanes.getPane.mockReturnValue(f.pane);
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page', reuseExistingPane: false });
    expect(f.pane.close).toHaveBeenCalled();
    expect(f.xrm.App.sidePanes.createPane).toHaveBeenCalled();
  });

  it('expands the rail by default and not when expandOnOpen is false', async () => {
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page' });
    expect(f.xrm.App.sidePanes.state).toBe(1);

    const g = fakeXrm(); __setXrm(g.xrm as any);
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page', expandOnOpen: false });
    expect(g.xrm.App.sidePanes.state).toBe(0);
  });

  it('surfaces failures through openErrorDialog', async () => {
    f.xrm.App.sidePanes.createPane.mockRejectedValue(new Error('boom'));
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page' });
    expect(f.xrm.Navigation.openErrorDialog).toHaveBeenCalledWith({ message: 'boom' });
  });

  it('rejects a call with no paneId', async () => {
    await open({ pageType: 'custom', name: 'sps_Page' } as any);
    expect(f.xrm.App.sidePanes.createPane).not.toHaveBeenCalled();
    expect(f.xrm.Navigation.openErrorDialog).toHaveBeenCalled();
  });
});

describe('SidePaneHelper — global attachment', () => {
  it('publishes SidePaneHelper.open on the window', async () => {
    await import('../runtime/index');
    expect(typeof (globalThis as any).SidePaneHelper?.open).toBe('function');
  });
});
