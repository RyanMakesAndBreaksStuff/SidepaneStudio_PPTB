import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PptbContextAdapter } from '../adapters/PptbContextAdapter';

function makeMockDataverseAPI(userId = 'user-abc-123') {
  return {
    execute: vi.fn().mockResolvedValue({ UserId: userId }),
    queryData: vi.fn().mockResolvedValue({ value: [] }),
    getAllEntitiesMetadata: vi.fn().mockResolvedValue({ value: [] }),
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

  it('getCurrentUserId resolves via WhoAmI using PPTB execute format', async () => {
    const api = makeMockDataverseAPI('user-xyz');
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const id = await adapter.getCurrentUserId();
    expect(id).toBe('user-xyz');
    expect(api.execute).toHaveBeenCalledWith({
      operationName: 'WhoAmI',
      operationType: 'function',
    }, undefined);
  });

  it('getCurrentUserId caches WhoAmI — only one execute call', async () => {
    const api = makeMockDataverseAPI('user-xyz');
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const id1 = await adapter.getCurrentUserId();
    const id2 = await adapter.getCurrentUserId();
    expect(id1).toBe('user-xyz');
    expect(id2).toBe('user-xyz');
    expect(api.execute).toHaveBeenCalledTimes(1);
  });

  it('getCurrentUserId clears a rejected WhoAmI promise so later calls can retry', async () => {
    const api = makeMockDataverseAPI('user-retry');
    api.execute
      .mockRejectedValueOnce(new Error('temporary WhoAmI failure'))
      .mockResolvedValueOnce({ UserId: 'user-retry' });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();

    await expect(adapter.getCurrentUserId()).rejects.toThrow('temporary WhoAmI failure');
    await expect(adapter.getCurrentUserId()).resolves.toBe('user-retry');
    expect(api.execute).toHaveBeenCalledTimes(2);
  });

  it('WhoAmI is lazy — no execute call before getCurrentUserId is called', () => {
    const api = makeMockDataverseAPI();
    vi.stubGlobal('dataverseAPI', api);
    new PptbContextAdapter();
    expect(api.execute).not.toHaveBeenCalled();
  });

  it('resetUserId clears cache — next call re-fetches WhoAmI', async () => {
    const api = makeMockDataverseAPI('user-xyz');
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.getCurrentUserId();
    adapter.resetUserId();
    await adapter.getCurrentUserId();
    expect(api.execute).toHaveBeenCalledTimes(2);
  });

  it('dataverseExecute passes PPTB format to window.dataverseAPI.execute', async () => {
    const api = makeMockDataverseAPI();
    api.execute.mockResolvedValue({ Privileges: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.dataverseExecute({
      operationName: 'RetrieveUserPrivileges',
      operationType: 'function',
      parameters: { UserId: 'user-123' },
    });
    expect(api.execute).toHaveBeenCalledWith({
      operationName: 'RetrieveUserPrivileges',
      operationType: 'function',
      parameters: { UserId: 'user-123' },
    }, undefined);
  });

  it('dataverseExecute omits optional fields when not provided', async () => {
    const api = makeMockDataverseAPI();
    api.execute.mockResolvedValue({ UserId: 'u' });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.dataverseExecute({ operationName: 'WhoAmI', operationType: 'function' });
    expect(api.execute).toHaveBeenCalledWith({
      operationName: 'WhoAmI',
      operationType: 'function',
    }, undefined);
  });

  it('getAllEntitiesMetadata unwraps value array', async () => {
    const api = makeMockDataverseAPI();
    api.getAllEntitiesMetadata.mockResolvedValue({ value: [{ LogicalName: 'account' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const result = await adapter.getAllEntitiesMetadata(['LogicalName']);
    expect(result).toEqual([{ LogicalName: 'account' }]);
    expect(api.getAllEntitiesMetadata).toHaveBeenCalledWith(['LogicalName'], undefined);
  });

  it('getAllEntitiesMetadata returns empty array when value is empty', async () => {
    const api = makeMockDataverseAPI();
    api.getAllEntitiesMetadata.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const result = await adapter.getAllEntitiesMetadata(['LogicalName']);
    expect(result).toEqual([]);
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

  it('checkWebResourceExists queries Dataverse and returns true when a row exists', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [{ webresourceid: 'wr-1' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    expect(await adapter.checkWebResourceExists("sps_/icons/o'brien.svg")).toBe(true);
    expect(api.queryData).toHaveBeenCalledWith(
      "webresourceset?$select=webresourceid&$filter=name eq 'sps_/icons/o''brien.svg'&$top=1",
      undefined
    );
  });

  it('checkWebResourceExists queries Dataverse and returns false when no row exists', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    expect(await adapter.checkWebResourceExists('missing.svg')).toBe(false);
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

  it('webApiGet strips /api/data/vN.N/ prefix and unwraps value', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [{ name: 'Acme' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const result = await adapter.webApiGet('/api/data/v9.2/accounts?$select=name');
    expect(api.queryData).toHaveBeenCalledWith('accounts?$select=name', undefined);
    expect(result).toEqual([{ name: 'Acme' }]);
  });

  it('webApiGet passes path unchanged when no prefix', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.webApiGet('contacts?$select=fullname');
    expect(api.queryData).toHaveBeenCalledWith('contacts?$select=fullname', undefined);
  });

  it('dataverseExecute forwards connectionTarget to window.dataverseAPI.execute', async () => {
    const api = makeMockDataverseAPI();
    api.execute.mockResolvedValue({ UserId: 'u' });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.dataverseExecute({ operationName: 'WhoAmI', operationType: 'function' }, 'secondary');
    expect(api.execute).toHaveBeenCalledWith(
      { operationName: 'WhoAmI', operationType: 'function' },
      'secondary'
    );
  });

  it('getAllEntitiesMetadata forwards connectionTarget', async () => {
    const api = makeMockDataverseAPI();
    api.getAllEntitiesMetadata.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.getAllEntitiesMetadata(['LogicalName'], 'secondary');
    expect(api.getAllEntitiesMetadata).toHaveBeenCalledWith(['LogicalName'], 'secondary');
  });

  it('dataverseExecute throws immediately when operationName is missing', async () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    await expect(
      adapter.dataverseExecute({ operationName: '', operationType: 'function' })
    ).rejects.toThrow('operationName');
  });

  it('dataverseExecute throws immediately when operationType is missing', async () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    await expect(
      adapter.dataverseExecute({ operationName: 'WhoAmI', operationType: '' as any })
    ).rejects.toThrow('operationType');
  });
});
