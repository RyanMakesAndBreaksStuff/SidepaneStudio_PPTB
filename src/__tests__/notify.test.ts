import { afterEach, describe, expect, it, vi } from 'vitest';
import { notify } from '../services/notify';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notify', () => {
  it('passes the title, body and type to the host', () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { utils: { showNotification } });
    notify('Saved', 'It worked.', 'success');
    expect(showNotification).toHaveBeenCalledWith({ title: 'Saved', body: 'It worked.', type: 'success' });
  });

  it('does nothing when the host has no notification API', () => {
    vi.stubGlobal('toolboxAPI', { utils: {} });
    expect(() => notify('t', 'b', 'info')).not.toThrow();
    vi.stubGlobal('toolboxAPI', undefined);
    expect(() => notify('t', 'b', 'info')).not.toThrow();
  });

  it('swallows a rejected or throwing notification', async () => {
    vi.stubGlobal('toolboxAPI', { utils: { showNotification: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(() => notify('t', 'b', 'error')).not.toThrow();
    vi.stubGlobal('toolboxAPI', { utils: { showNotification: vi.fn(() => { throw new Error('sync'); }) } });
    expect(() => notify('t', 'b', 'error')).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it.each(['error', 'warning'] as const)('keeps a %s notification on screen until dismissed (r2 WR-004)', type => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { utils: { showNotification } });
    notify('Preferences not saved', 'The write failed.', type);
    expect(showNotification).toHaveBeenCalledWith({ title: 'Preferences not saved', body: 'The write failed.', type, duration: 0 });
  });

  it('leaves an info notification on the host timer', () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('toolboxAPI', { utils: { showNotification } });
    notify('Link copied', 'Paste it into a browser.', 'info');
    expect(showNotification).toHaveBeenCalledWith({ title: 'Link copied', body: 'Paste it into a browser.', type: 'info' });
  });
});
