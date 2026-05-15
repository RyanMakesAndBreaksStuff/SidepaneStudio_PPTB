import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PptbContextAdapter } from '../adapters/PptbContextAdapter';

function makeMockDataverseAPI(userId = 'user-abc-123') {
  return {
    execute: vi.fn().mockResolvedValue({ UserId: userId }),
    queryData: vi.fn(),
    getAllEntitiesMetadata: vi.fn(),
  };
}

describe('PptbContextAdapter', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('isAvailable and sidePanesAvailable are false', () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(adapter.isAvailable).toBe(false);
    expect(adapter.sidePanesAvailable).toBe(false);
  });

  it('getCurrentUserId resolves via WhoAmI and is cached', async () => {
    const api = makeMockDataverseAPI('user-xyz');
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const id1 = await adapter.getCurrentUserId();
    const id2 = await adapter.getCurrentUserId();
    expect(id1).toBe('user-xyz');
    expect(id2).toBe('user-xyz');
    expect(api.execute).toHaveBeenCalledTimes(1); // cached — only one WhoAmI call
    expect(api.execute).toHaveBeenCalledWith({ RequestName: 'WhoAmI' });
  });

  it('createPane throws', async () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    await expect(adapter.createPane({ paneId: 'x' })).rejects.toThrow();
  });

  it('getPane returns undefined', () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(adapter.getPane('any')).toBeUndefined();
  });

  it('getHostKind returns Unknown', () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(adapter.getHostKind()).toBe('Unknown');
  });

  it('checkWebResourceExists always resolves true', async () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(await adapter.checkWebResourceExists('anything')).toBe(true);
  });

  it('readEnvVar always resolves null', async () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(await adapter.readEnvVar('MY_VAR')).toBeNull();
  });

  it('getCurrentAppId returns null', () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(adapter.getCurrentAppId()).toBeNull();
  });

  it('webApiGet strips /api/data/v9.x/ prefix', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.webApiGet('/api/data/v9.2/accounts?$select=name');
    expect(api.queryData).toHaveBeenCalledWith('accounts?$select=name');
  });

  it('webApiGet passes path unchanged when no prefix', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.webApiGet('contacts?$select=fullname');
    expect(api.queryData).toHaveBeenCalledWith('contacts?$select=fullname');
  });
});
