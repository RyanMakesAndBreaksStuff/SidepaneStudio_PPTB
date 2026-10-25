import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { SidePaneHelperOptions } from '../runtime/sidePaneHelper';
import runtimeSource from '../runtime/sidepane.runtime.js?raw';

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

/** Calls the shipped bytes: Download runtime saves this same file. */
function open(options: SidePaneHelperOptions): Promise<void> {
  return (globalThis as unknown as { SidePaneHelper: { open: typeof open } }).SidePaneHelper.open(options);
}

beforeEach(() => { (0, eval)(runtimeSource); });
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, 'SidePaneHelper');
});

describe('SidePaneHelper.open — createPane options (contract C4/C3)', () => {
  let f: ReturnType<typeof fakeXrm>;
  beforeEach(() => { f = fakeXrm(); vi.stubGlobal('Xrm', f.xrm); });

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
    expect(f.pane.navigate.mock.invocationCallOrder[0])
      .toBeLessThan(f.pane.select.mock.invocationCallOrder[0]);
  });

  it('shared helper closes other panes after reusing one', async () => {
    const events: string[] = [];
    const f = fakeXrm();
    vi.stubGlobal('Xrm', f.xrm);
    f.xrm.App.sidePanes.getPane.mockReturnValue(f.pane);
    f.pane.navigate.mockImplementation(async () => { events.push('navigate'); });
    f.pane.select.mockImplementation(() => { events.push('select'); });
    const other = { paneId: 'other', close: vi.fn(() => { events.push('closeOther'); }) };
    f.xrm.App.sidePanes.getAllPanes.mockReturnValue([f.pane, other]);
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page', reuseExistingPane: true, closeOthers: true });
    expect(events).toEqual(['navigate', 'select', 'closeOther']);
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

    const g = fakeXrm();
    vi.stubGlobal('Xrm', g.xrm);
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
  it('warns and opens nothing when side panes are unavailable', async () => {
    vi.stubGlobal('Xrm', { Navigation: f.xrm.Navigation });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page' });
    expect(warn).toHaveBeenCalledWith('SidePaneHelper.open: side panes are not available in this client.');
    expect(f.xrm.Navigation.openErrorDialog).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it('closes the selected, expanded pane when toggleIfOpen is set', async () => {
    const selected = { paneId: 'p', close: vi.fn() };
    Object.assign(f.xrm.App.sidePanes, { state: 1, getSelectedPane: vi.fn().mockReturnValue(selected) });
    await open({ paneId: 'p', pageType: 'custom', name: 'sps_Page', toggleIfOpen: true });
    expect(selected.close).toHaveBeenCalled();
    expect(f.pane.navigate).not.toHaveBeenCalled();
  });
});

describe('SidePaneHelper — global attachment', () => {
  it('publishes SidePaneHelper.open on the window', () => {
    expect(typeof (globalThis as any).SidePaneHelper?.open).toBe('function');
  });
});
