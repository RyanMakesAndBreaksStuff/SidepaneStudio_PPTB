import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PptbContextAdapter, type DataverseError } from '../adapters/PptbContextAdapter';

function makeMockDataverseAPI() {
  return {
    queryData: vi.fn().mockResolvedValue({ value: [] }),
  };
}

describe('PptbContextAdapter', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchXml delegates to fetchXmlQuery and returns the host result as-is', async () => {
    const result = { value: [{ name: 'Acme' }] };
    const api = { ...makeMockDataverseAPI(), fetchXmlQuery: vi.fn().mockResolvedValue(result) };
    vi.stubGlobal('dataverseAPI', api);
    await expect(new PptbContextAdapter().fetchXml('<fetch/>')).resolves.toBe(result);
    expect(api.fetchXmlQuery).toHaveBeenCalledWith('<fetch/>');
  });

  it('fetchXml normalises non-Error rejections', async () => {
    const api = { ...makeMockDataverseAPI(), fetchXmlQuery: vi.fn().mockRejectedValue('boom') };
    vi.stubGlobal('dataverseAPI', api);
    await expect(new PptbContextAdapter().fetchXml('<fetch/>')).rejects.toBeInstanceOf(Error);
  });

  it('checkWebResourceExists queries Dataverse and returns true when a row exists', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [{ webresourceid: 'wr-1' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    expect(await adapter.checkWebResourceExists("sps_/icons/o'brien.svg")).toBe(true);
    expect(api.queryData).toHaveBeenCalledWith(
      "webresourceset?$select=webresourceid&$filter=name eq 'sps_/icons/o''brien.svg'&$top=1"
    );
  });

  it('checkWebResourceExists queries Dataverse and returns false when no row exists', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    expect(await adapter.checkWebResourceExists('missing.svg')).toBe(false);
  });

  it('webApiGet strips /api/data/vN.N/ prefix and unwraps value', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [{ name: 'Acme' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const result = await adapter.webApiGet('/api/data/v9.2/accounts?$select=name');
    expect(api.queryData).toHaveBeenCalledWith('accounts?$select=name');
    expect(result).toEqual([{ name: 'Acme' }]);
  });

  it('webApiGet passes path unchanged when no prefix', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.webApiGet('contacts?$select=fullname');
    expect(api.queryData).toHaveBeenCalledWith('contacts?$select=fullname');
  });

  it('webApiGet throws when the response has no value array', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ accountid: 'a-1' });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await expect(adapter.webApiGet('accounts')).rejects.toThrow(
      'Unexpected response for accounts: missing value array',
    );
  });

  it('webApiGet throws when the response is null', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue(null);
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await expect(adapter.webApiGet('accounts')).rejects.toThrow('missing value array');
  });

  it('webApiGetEntity unwraps a single-element value array', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [{ name: 'Acme' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    expect(await adapter.webApiGetEntity('accounts(1)')).toEqual({ name: 'Acme' });
  });

  it('webApiGetEntity returns the result as-is when it is not a single-element value array', async () => {
    const api = makeMockDataverseAPI();
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    api.queryData.mockResolvedValue({ name: 'Acme' });
    expect(await adapter.webApiGetEntity('accounts(1)')).toEqual({ name: 'Acme' });
    api.queryData.mockResolvedValue({ value: [{ a: 1 }, { a: 2 }] });
    expect(await adapter.webApiGetEntity('accounts')).toEqual({ value: [{ a: 1 }, { a: 2 }] });
  });

  describe('rejection normalisation', () => {
    const calls: Array<[string, (a: PptbContextAdapter) => Promise<unknown>]> = [
      ['webApiGet', a => a.webApiGet('accounts')],
      ['webApiGetEntity', a => a.webApiGetEntity('accounts(1)')],
      ['checkWebResourceExists', a => a.checkWebResourceExists('new_x')],
    ];

    it.each(calls)('%s rejects with a DataverseError carrying status', async (_n, call) => {
      const api = makeMockDataverseAPI();
      api.queryData.mockRejectedValue({ message: 'Forbidden', status: 403, statusText: 'Forbidden' });
      vi.stubGlobal('dataverseAPI', api);
      const err = await call(new PptbContextAdapter()).catch((e: unknown) => e) as DataverseError;
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Forbidden');
      expect(err.status).toBe(403);
      expect(err.statusText).toBe('Forbidden');
    });

    it.each(calls)('%s JSON-stringifies a rejection without a message', async (_n, call) => {
      const api = makeMockDataverseAPI();
      api.queryData.mockRejectedValue({ code: 'X' });
      vi.stubGlobal('dataverseAPI', api);
      const err = await call(new PptbContextAdapter()).catch((e: unknown) => e) as Error;
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('{"code":"X"}');
    });

    it.each(calls)('%s passes a real Error through as the same instance', async (_n, call) => {
      const original = new Error('boom');
      const api = makeMockDataverseAPI();
      api.queryData.mockRejectedValue(original);
      vi.stubGlobal('dataverseAPI', api);
      const err = await call(new PptbContextAdapter()).catch((e: unknown) => e);
      expect(err).toBe(original);
    });
  });
});
