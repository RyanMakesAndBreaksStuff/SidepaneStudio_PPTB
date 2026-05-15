import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataService } from '../services/MetadataService';
import type { IXrmContext } from '../adapters/PptbContextAdapter';

function makeXrm(userId = 'user-123'): Pick<IXrmContext, 'getCurrentUserId'> {
  return {
    getCurrentUserId: vi.fn().mockResolvedValue(userId),
  };
}

function makeDataverseAPI(entities: object[] = [], privileges: object[] = []) {
  return {
    getAllEntitiesMetadata: vi.fn().mockResolvedValue(entities),
    execute: vi.fn().mockResolvedValue({ Privileges: privileges }),
  };
}

const ENTITY_ACCOUNT = {
  LogicalName: 'account',
  DisplayName: { UserLocalizedLabel: { Label: 'Account' } },
  ObjectTypeCode: 1,
  IsIntersect: false,
  IsPrivate: false,
  Privileges: [{ PrivilegeId: 'priv-write-account', Name: 'prvWriteaccount' }],
};

const PRIV_WRITE_ACCOUNT = { PrivilegeId: 'priv-write-account', Depth: 1 };

describe('MetadataService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns accessible tables when user has write privilege', async () => {
    vi.stubGlobal('dataverseAPI', makeDataverseAPI([ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]));
    const svc = new MetadataService(makeXrm());
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].logicalName).toBe('account');
      expect(result.tables[0].displayName).toBe('Account');
    }
  });

  it('excludes entities without matching write privilege', async () => {
    vi.stubGlobal('dataverseAPI', makeDataverseAPI([ENTITY_ACCOUNT], [])); // no privileges
    const svc = new MetadataService(makeXrm());
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.tables).toHaveLength(0);
    }
  });

  it('caches result — second call skips dataverseAPI', async () => {
    const api = makeDataverseAPI([ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    vi.stubGlobal('dataverseAPI', api);
    const svc = new MetadataService(makeXrm());
    await svc.listAccessibleTables();
    await svc.listAccessibleTables();
    expect(api.getAllEntitiesMetadata).toHaveBeenCalledTimes(1);
  });

  it('invalidate clears cache — next call re-fetches', async () => {
    const api = makeDataverseAPI([ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    vi.stubGlobal('dataverseAPI', api);
    const svc = new MetadataService(makeXrm());
    await svc.listAccessibleTables();
    svc.invalidate();
    await svc.listAccessibleTables();
    expect(api.getAllEntitiesMetadata).toHaveBeenCalledTimes(2);
  });

  it('returns error status when dataverseAPI throws', async () => {
    vi.stubGlobal('dataverseAPI', {
      getAllEntitiesMetadata: vi.fn().mockRejectedValue(new Error('Network error')),
      execute: vi.fn(),
    });
    const svc = new MetadataService(makeXrm());
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('error');
  });

  it('cache key includes userId — different users get fresh fetch', async () => {
    const api = makeDataverseAPI([ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    vi.stubGlobal('dataverseAPI', api);
    const svc1 = new MetadataService(makeXrm('user-A'));
    const svc2 = new MetadataService(makeXrm('user-B'));
    await svc1.listAccessibleTables();
    await svc2.listAccessibleTables();
    expect(api.getAllEntitiesMetadata).toHaveBeenCalledTimes(2);
  });
});
