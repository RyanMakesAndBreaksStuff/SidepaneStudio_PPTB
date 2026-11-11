import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RUNTIME_WEB_RESOURCE_SUFFIX } from '../constants';
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

  it('checkWebResourceExists matches by name suffix and returns the first deployed name', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [{ name: 'acme_/scripts/sidepane.runtime.js' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    expect(await adapter.checkWebResourceExists(RUNTIME_WEB_RESOURCE_SUFFIX)).toBe('acme_/scripts/sidepane.runtime.js');
    expect(api.queryData).toHaveBeenCalledWith(
      "webresourceset?$select=name&$filter=endswith(name,'/scripts/sidepane.runtime.js')&$top=1"
    );
  });

  it('checkWebResourceExists escapes single quotes in the suffix', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    await new PptbContextAdapter().checkWebResourceExists("/o'brien.svg");
    expect(api.queryData).toHaveBeenCalledWith(
      "webresourceset?$select=name&$filter=endswith(name,'/o''brien.svg')&$top=1"
    );
  });

  it('checkWebResourceExists returns null when no row exists', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    expect(await adapter.checkWebResourceExists(RUNTIME_WEB_RESOURCE_SUFFIX)).toBeNull();
  });

  it('webApiGet forwards the path verbatim and unwraps value', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [{ name: 'Acme' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const result = await adapter.webApiGet('/api/data/v9.2/accounts?$select=name');
    expect(api.queryData).toHaveBeenCalledWith('/api/data/v9.2/accounts?$select=name');
    expect(result).toEqual([{ name: 'Acme' }]);
  });

  it('webApiGetEntity forwards the path verbatim', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ name: 'Acme' });
    vi.stubGlobal('dataverseAPI', api);
    await new PptbContextAdapter().webApiGetEntity('/api/data/v9.2/accounts(1)');
    expect(api.queryData).toHaveBeenCalledWith('/api/data/v9.2/accounts(1)');
  });

  it('webApiGet passes a relative path unchanged', async () => {
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

    it.each(calls)('%s strips the host transport prefix and parses the HTTP status', async (_n, call) => {
      const api = makeMockDataverseAPI();
      api.queryData.mockRejectedValue(
        new Error("Error invoking remote method 'dataverse.queryData': Error: queryData failed: HTTP 404 Not Found"));
      vi.stubGlobal('dataverseAPI', api);
      const err = await call(new PptbContextAdapter()).catch((e: unknown) => e) as DataverseError;
      expect(err.message).toBe('queryData failed: HTTP 404 Not Found');
      expect(err.status).toBe(404);
    });

    it.each(calls)('%s keeps the host message and leaves status unset when no HTTP code is present', async (_n, call) => {
      const api = makeMockDataverseAPI();
      api.queryData.mockRejectedValue(new Error(
        "Error invoking remote method 'dataverse.queryData': Error: queryData failed: 0x80040220: Principal user is missing privilege"));
      vi.stubGlobal('dataverseAPI', api);
      const err = await call(new PptbContextAdapter()).catch((e: unknown) => e) as DataverseError;
      expect(err.message).toBe('queryData failed: 0x80040220: Principal user is missing privilege');
      expect(err.status).toBeUndefined();
    });

    it.each([
      ['0x80040217', 404], ['0x80072322', 429], ['0x80072321', 429], ['0x80072326', 429], ['0X80040217', 404],
    ])('reads the status from Dataverse error code %s when the host sends no HTTP code (revie2 WR-005)', async (code, status) => {
      const api = makeMockDataverseAPI();
      api.queryData.mockRejectedValue(new Error(
        `Error invoking remote method 'dataverse.queryData': Error: queryData failed: ${code}: systemform does not exist`));
      vi.stubGlobal('dataverseAPI', api);
      const err = await calls[0][1](new PptbContextAdapter()).catch((e: unknown) => e) as DataverseError;
      expect(err.message).toBe(`queryData failed: ${code}: systemform does not exist`);
      expect(err.status).toBe(status);
    });
  });
});
