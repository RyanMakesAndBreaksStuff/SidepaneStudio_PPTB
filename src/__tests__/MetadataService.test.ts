import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataService } from '../services/MetadataService';
import type { IXrmContext } from '../adapters/PptbContextAdapter';

type MetaXrm = Pick<IXrmContext, 'webApiGet'>;

function makeXrm(entityResponse: object = { value: [] }, dashboardResponse?: { sys: object; user: object }): MetaXrm {
  const xrm: MetaXrm = {
    webApiGet: vi.fn(),
  };
  const mock = xrm.webApiGet as ReturnType<typeof vi.fn>;

  if (dashboardResponse) {
    mock
      .mockResolvedValueOnce(entityResponse)      // first call: EntityDefinitions
      .mockResolvedValueOnce(dashboardResponse.sys)  // second: systemdashboards
      .mockResolvedValueOnce(dashboardResponse.user); // third: userdashboards
  } else {
    mock.mockResolvedValue(entityResponse);
  }

  return xrm;
}

// A valid entity that passes keepEntity filtering (custom entity with EntitySetName)
const ENTITY_ACCOUNT = {
  LogicalName: 'account',
  SchemaName: 'Account',
  DisplayName: { UserLocalizedLabel: { Label: 'Account' } },
  EntitySetName: 'accounts',
  ObjectTypeCode: 1,
  IsCustomEntity: false,
  IsActivity: false,
  IsIntersect: false,
  IsPrivate: false,
  OwnershipType: 'UserOwned',
  CanCreateForms: { Value: true },
  CanModifyAdditionalSettings: { Value: true },
  IsCustomizable: { Value: true },
};

const ENTITY_CUSTOM = {
  LogicalName: 'new_widget',
  SchemaName: 'new_Widget',
  DisplayName: { UserLocalizedLabel: { Label: 'Widget' } },
  EntitySetName: 'new_widgets',
  ObjectTypeCode: 10001,
  IsCustomEntity: true,
  IsActivity: false,
  IsIntersect: false,
  IsPrivate: false,
  OwnershipType: 'UserOwned',
  CanCreateForms: { Value: true },
  CanModifyAdditionalSettings: { Value: true },
  IsCustomizable: { Value: true },
};

const ENTITY_INTERSECT = { ...ENTITY_ACCOUNT, LogicalName: 'accountleads', IsIntersect: true };
const ENTITY_PRIVATE = { ...ENTITY_ACCOUNT, LogicalName: 'something', IsPrivate: true };
const ENTITY_ACTIVITY = { ...ENTITY_ACCOUNT, LogicalName: 'task', IsActivity: true };
const ENTITY_NO_ENTITY_SET = { ...ENTITY_ACCOUNT, EntitySetName: null };
const ENTITY_DENY_PREFIX = { ...ENTITY_CUSTOM, LogicalName: 'msdyn_something' };
const ENTITY_DENY_EXACT = { ...ENTITY_ACCOUNT, LogicalName: 'webresource' };
const ENTITY_NO_FORMS = { ...ENTITY_CUSTOM, CanCreateForms: { Value: false } };
const ENTITY_ORG_OWNED_NO_PREFIX = {
  ...ENTITY_ACCOUNT,
  LogicalName: 'organization',
  SchemaName: 'Organization',
  OwnershipType: 'OrganizationOwned',
};

describe('MetadataService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listAccessibleTables', () => {
    it('returns tables that pass keepEntity filter', async () => {
      const xrm = makeXrm({ value: [ENTITY_ACCOUNT, ENTITY_CUSTOM] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.tables.map(t => t.logicalName)).toContain('account');
      expect(result.tables.map(t => t.logicalName)).toContain('new_widget');
    });

    it('excludes intersect entities', async () => {
      const xrm = makeXrm({ value: [ENTITY_INTERSECT] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes private entities', async () => {
      const xrm = makeXrm({ value: [ENTITY_PRIVATE] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes activity entities', async () => {
      const xrm = makeXrm({ value: [ENTITY_ACTIVITY] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes entities with no EntitySetName', async () => {
      const xrm = makeXrm({ value: [ENTITY_NO_ENTITY_SET] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes entities with denied prefixes (msdyn_, adx_, etc.)', async () => {
      const xrm = makeXrm({ value: [ENTITY_DENY_PREFIX] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes exact-denied entity names (webresource, savedquery, etc.)', async () => {
      const xrm = makeXrm({ value: [ENTITY_DENY_EXACT] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes entities where CanCreateForms is false', async () => {
      const xrm = makeXrm({ value: [ENTITY_NO_FORMS] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes OrganizationOwned tables with no underscore in schema name', async () => {
      const xrm = makeXrm({ value: [ENTITY_ORG_OWNED_NO_PREFIX] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('uses displayName from UserLocalizedLabel', async () => {
      const xrm = makeXrm({ value: [ENTITY_ACCOUNT] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables[0].displayName).toBe('Account');
    });

    it('falls back to LogicalName when no DisplayName', async () => {
      const noLabel = { ...ENTITY_CUSTOM, DisplayName: null };
      const xrm = makeXrm({ value: [noLabel] });
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables[0].displayName).toBe('new_widget');
    });

    it('caches result — second call does not re-fetch', async () => {
      const xrm = makeXrm({ value: [ENTITY_ACCOUNT] });
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables();
      await svc.listAccessibleTables();
      expect(xrm.webApiGet).toHaveBeenCalledTimes(1);
    });

    it('invalidate clears cache — next call re-fetches', async () => {
      const xrm = makeXrm({ value: [ENTITY_ACCOUNT] });
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables();
      svc.invalidate();
      await svc.listAccessibleTables();
      expect(xrm.webApiGet).toHaveBeenCalledTimes(2);
    });

    it('returns error status when webApiGet throws', async () => {
      const xrm: MetaXrm = {
        webApiGet: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(result.reason).toBe('Network error');
    });

    it('uses buildEntityDefinitionsPath — call starts with EntityDefinitions', async () => {
      const xrm = makeXrm({ value: [] });
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables();
      const calledPath = (xrm.webApiGet as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledPath).toMatch(/^EntityDefinitions\?/);
    });

    it('does not log to console during normal operation', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const xrm = makeXrm({ value: [ENTITY_ACCOUNT] });
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables();
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('forwards connectionTarget to webApiGet', async () => {
      const xrm = makeXrm({ value: [] });
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables('secondary');
      expect(xrm.webApiGet).toHaveBeenCalledWith(expect.any(String), 'secondary');
    });

    it('cache key includes connectionTarget — primary and secondary are independent', async () => {
      const xrm = makeXrm({ value: [] });
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables('primary');
      await svc.listAccessibleTables('secondary');
      expect(xrm.webApiGet).toHaveBeenCalledTimes(2);
    });
  });
});
