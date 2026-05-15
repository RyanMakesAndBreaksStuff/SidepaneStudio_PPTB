import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataService } from '../services/MetadataService';
import type { IXrmContext } from '../adapters/PptbContextAdapter';

type MetaXrm = Pick<IXrmContext, 'getCurrentUserId' | 'dataverseExecute' | 'getAllEntitiesMetadata'>;

function makeXrm(
  userId = 'user-123',
  entities: object[] = [],
  privileges: object[] = []
): MetaXrm {
  return {
    getCurrentUserId: vi.fn().mockResolvedValue(userId),
    getAllEntitiesMetadata: vi.fn().mockResolvedValue(entities),
    dataverseExecute: vi.fn().mockResolvedValue({ Privileges: privileges }),
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
    const xrm = makeXrm('user-123', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].logicalName).toBe('account');
      expect(result.tables[0].displayName).toBe('Account');
    }
  });

  it('passes correct PPTB execute format for RetrieveUserPrivileges', async () => {
    const xrm = makeXrm('user-abc', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    await svc.listAccessibleTables();
    expect(xrm.dataverseExecute).toHaveBeenCalledWith({
      operationName: 'RetrieveUserPrivileges',
      operationType: 'function',
      parameters: { UserId: 'user-abc' },
    }, undefined);
  });

  it('passes correct property list to getAllEntitiesMetadata', async () => {
    const xrm = makeXrm('user-123', [], []);
    const svc = new MetadataService(xrm);
    await svc.listAccessibleTables();
    expect(xrm.getAllEntitiesMetadata).toHaveBeenCalledWith([
      'LogicalName', 'DisplayName', 'ObjectTypeCode',
      'IsIntersect', 'IsPrivate', 'Privileges',
    ], undefined);
  });

  it('excludes entities without matching write privilege', async () => {
    const xrm = makeXrm('user-123', [ENTITY_ACCOUNT], []);
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.tables).toHaveLength(0);
    }
  });

  it('excludes intersect entities', async () => {
    const intersect = { ...ENTITY_ACCOUNT, IsIntersect: true };
    const xrm = makeXrm('user-123', [intersect], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.tables).toHaveLength(0);
    }
  });

  it('excludes private entities', async () => {
    const priv = { ...ENTITY_ACCOUNT, IsPrivate: true };
    const xrm = makeXrm('user-123', [priv], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.tables).toHaveLength(0);
    }
  });

  it('caches result — second call skips getAllEntitiesMetadata and dataverseExecute', async () => {
    const xrm = makeXrm('user-123', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    await svc.listAccessibleTables();
    await svc.listAccessibleTables();
    expect(xrm.getAllEntitiesMetadata).toHaveBeenCalledTimes(1);
    expect(xrm.dataverseExecute).toHaveBeenCalledTimes(1);
  });

  it('invalidate clears cache — next call re-fetches', async () => {
    const xrm = makeXrm('user-123', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    await svc.listAccessibleTables();
    svc.invalidate();
    await svc.listAccessibleTables();
    expect(xrm.getAllEntitiesMetadata).toHaveBeenCalledTimes(2);
  });

  it('returns error status when dataverseExecute throws', async () => {
    const xrm = makeXrm();
    (xrm.dataverseExecute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toBe('Network error');
    }
  });

  it('returns error status when getAllEntitiesMetadata throws', async () => {
    const xrm = makeXrm();
    (xrm.getAllEntitiesMetadata as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Metadata error'));
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toBe('Metadata error');
    }
  });

  it('cache key is per userId — different users get independent fetches', async () => {
    const xrm1 = makeXrm('user-A', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const xrm2 = makeXrm('user-B', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const svc1 = new MetadataService(xrm1);
    const svc2 = new MetadataService(xrm2);
    await svc1.listAccessibleTables();
    await svc2.listAccessibleTables();
    expect(xrm1.getAllEntitiesMetadata).toHaveBeenCalledTimes(1);
    expect(xrm2.getAllEntitiesMetadata).toHaveBeenCalledTimes(1);
  });

  it('no global window.dataverseAPI stub needed — uses injected xrm', async () => {
    expect((window as any).dataverseAPI).toBeUndefined();
    const xrm = makeXrm('user-123', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
  });

  it('listAccessibleTables forwards connectionTarget to xrm calls', async () => {
    const xrm = makeXrm('user-123', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    await svc.listAccessibleTables('secondary');
    expect(xrm.getAllEntitiesMetadata).toHaveBeenCalledWith(
      ['LogicalName', 'DisplayName', 'ObjectTypeCode', 'IsIntersect', 'IsPrivate', 'Privileges'],
      'secondary'
    );
    expect(xrm.dataverseExecute).toHaveBeenCalledWith(
      expect.objectContaining({ operationName: 'RetrieveUserPrivileges' }),
      'secondary'
    );
  });

  it('skips entity privilege with missing PrivilegeId — does not throw', async () => {
    const entityWithBadPriv = {
      ...ENTITY_ACCOUNT,
      Privileges: [{ Name: 'prvWriteaccount' }], // no PrivilegeId
    };
    const xrm = makeXrm('user-123', [entityWithBadPriv], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.tables).toHaveLength(0);
    }
  });
});
