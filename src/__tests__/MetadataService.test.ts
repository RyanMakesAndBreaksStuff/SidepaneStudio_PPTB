import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataService } from '../services/MetadataService';
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';

type MetaXrm = Pick<IXrmContext, 'webApiGet'>;

function makeXrm(entityResponse: object = [], dashboardResponse?: { sys: object; user: object }): MetaXrm {
  const xrm: MetaXrm = {
    webApiGet: vi.fn(),
  };
  const mock = xrm.webApiGet as ReturnType<typeof vi.fn>;

  if (dashboardResponse) {
    mock
      .mockResolvedValueOnce(entityResponse)      // first call: EntityDefinitions
      .mockResolvedValueOnce(dashboardResponse.sys)  // second: systemforms
      .mockResolvedValueOnce(dashboardResponse.user); // third: userforms
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
const ENTITY_STANDARD_LOCKED = {
  ...ENTITY_ACCOUNT,
  LogicalName: 'competitor',
  SchemaName: 'Competitor',
  DisplayName: { UserLocalizedLabel: { Label: 'Competitor' } },
  EntitySetName: 'competitors',
  IsCustomEntity: false,
  IsCustomizable: { Value: false },
};

describe('MetadataService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listAccessibleTables', () => {
    it('returns tables that pass keepEntity filter', async () => {
      const xrm = makeXrm([ENTITY_ACCOUNT, ENTITY_CUSTOM]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.tables.map(t => t.logicalName)).toContain('account');
      expect(result.tables.map(t => t.logicalName)).toContain('new_widget');
    });

    it('accepts unwrapped collection arrays from webApiGet', async () => {
      const xrm: MetaXrm = {
        webApiGet: vi.fn().mockResolvedValue([ENTITY_ACCOUNT]),
      };
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].logicalName).toBe('account');
    });

    it('excludes intersect entities', async () => {
      const xrm = makeXrm([ENTITY_INTERSECT]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes private entities', async () => {
      const xrm = makeXrm([ENTITY_PRIVATE]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes activity entities', async () => {
      const xrm = makeXrm([ENTITY_ACTIVITY]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes entities with no EntitySetName', async () => {
      const xrm = makeXrm([ENTITY_NO_ENTITY_SET]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes entities with denied prefixes (msdyn_, adx_, etc.)', async () => {
      const xrm = makeXrm([ENTITY_DENY_PREFIX]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes exact-denied entity names (webresource, savedquery, etc.)', async () => {
      const xrm = makeXrm([ENTITY_DENY_EXACT]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes entities where CanCreateForms is false', async () => {
      const xrm = makeXrm([ENTITY_NO_FORMS]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('excludes OrganizationOwned tables with no underscore in schema name', async () => {
      const xrm = makeXrm([ENTITY_ORG_OWNED_NO_PREFIX]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables).toHaveLength(0);
    });

    it('uses displayName from UserLocalizedLabel', async () => {
      const xrm = makeXrm([ENTITY_ACCOUNT]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables[0].displayName).toBe('Account');
    });

    it('falls back to LogicalName when no DisplayName', async () => {
      const noLabel = { ...ENTITY_CUSTOM, DisplayName: null };
      const xrm = makeXrm([noLabel]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleTables();
      if (result.status !== 'ok') return;
      expect(result.tables[0].displayName).toBe('new_widget');
    });

    it('caches result — second call does not re-fetch', async () => {
      const xrm = makeXrm([ENTITY_ACCOUNT]);
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables();
      await svc.listAccessibleTables();
      expect(xrm.webApiGet).toHaveBeenCalledTimes(1);
    });

    it('invalidate clears cache — next call re-fetches', async () => {
      const xrm = makeXrm([ENTITY_ACCOUNT]);
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
      const xrm = makeXrm([]);
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables();
      const calledPath = (xrm.webApiGet as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledPath).toMatch(/^EntityDefinitions\?/);
    });

    it('does not log to console during normal operation', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const xrm = makeXrm([ENTITY_ACCOUNT]);
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables();
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('forwards connectionTarget to webApiGet', async () => {
      const xrm = makeXrm([]);
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables('secondary');
      expect(xrm.webApiGet).toHaveBeenCalledWith(expect.any(String), 'secondary');
    });

    it('cache key includes connectionTarget — primary and secondary are independent', async () => {
      const xrm = makeXrm([]);
      const svc = new MetadataService(xrm);
      await svc.listAccessibleTables('primary');
      await svc.listAccessibleTables('secondary');
      expect(xrm.webApiGet).toHaveBeenCalledTimes(2);
    });

    it('uses custom filter config for exact denies and allowed standard tables', async () => {
      const xrm = makeXrm([ENTITY_ACCOUNT, ENTITY_STANDARD_LOCKED]);
      const svc = new MetadataService(xrm, {
        ...DEFAULT_METADATA_FILTER_CONFIG,
        denyExact: [...DEFAULT_METADATA_FILTER_CONFIG.denyExact, 'account'],
        allowedStandardTables: [...DEFAULT_METADATA_FILTER_CONFIG.allowedStandardTables, 'competitor'],
      });

      const result = await svc.listAccessibleTables();

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.tables.map(t => t.logicalName)).toEqual(['competitor']);
    });

    it('setFilterConfig clears cached table results', async () => {
      const xrm: MetaXrm = {
        webApiGet: vi.fn()
          .mockResolvedValueOnce([ENTITY_ACCOUNT])
          .mockResolvedValueOnce([ENTITY_ACCOUNT]),
      };
      const svc = new MetadataService(xrm);

      const first = await svc.listAccessibleTables();
      expect(first.status).toBe('ok');
      if (first.status !== 'ok') return;
      expect(first.tables.map(t => t.logicalName)).toEqual(['account']);

      svc.setFilterConfig({
        ...DEFAULT_METADATA_FILTER_CONFIG,
        denyExact: [...DEFAULT_METADATA_FILTER_CONFIG.denyExact, 'account'],
      });

      const second = await svc.listAccessibleTables();
      expect(second.status).toBe('ok');
      if (second.status !== 'ok') return;
      expect(second.tables).toHaveLength(0);
      expect(xrm.webApiGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('listAccessibleDashboards', () => {
    const SYS_DASH = { name: 'Sales Dashboard', formid: 'aaaaaaaa-0000-0000-0000-000000000001' };
    const USER_DASH = { name: 'My Dashboard', userformid: 'bbbbbbbb-0000-0000-0000-000000000002' };

    function makeXrmForDashboards(
      sysValue: object[] = [],
      userValue: object[] = []
    ): Pick<IXrmContext, 'webApiGet'> {
      return {
        webApiGet: vi.fn()
          .mockResolvedValueOnce(sysValue)
          .mockResolvedValueOnce(userValue),
      };
    }

    it('returns system and personal dashboards merged and sorted by name', async () => {
      const xrm = makeXrmForDashboards([SYS_DASH], [USER_DASH]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleDashboards();
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.dashboards).toHaveLength(2);
      const names = result.dashboards.map(d => d.name);
      expect(names).toContain('Sales Dashboard');
      expect(names).toContain('My Dashboard');
    });

    it('maps dashboard ids from systemform and userform collections', async () => {
      const xrm: Pick<IXrmContext, 'webApiGet'> = {
        webApiGet: vi.fn()
          .mockResolvedValueOnce([SYS_DASH])
          .mockResolvedValueOnce([USER_DASH]),
      };
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleDashboards();
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.dashboards).toEqual([
        { id: USER_DASH.userformid, name: 'My Dashboard', isPersonal: true },
        { id: SYS_DASH.formid, name: 'Sales Dashboard', isPersonal: false },
      ]);
    });

    it('marks system dashboards as isPersonal: false', async () => {
      const xrm = makeXrmForDashboards([SYS_DASH], []);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleDashboards();
      if (result.status !== 'ok') return;
      expect(result.dashboards[0].isPersonal).toBe(false);
      expect(result.dashboards[0].id).toBe(SYS_DASH.formid);
    });

    it('marks user dashboards as isPersonal: true', async () => {
      const xrm = makeXrmForDashboards([], [USER_DASH]);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleDashboards();
      if (result.status !== 'ok') return;
      expect(result.dashboards[0].isPersonal).toBe(true);
      expect(result.dashboards[0].id).toBe(USER_DASH.userformid);
    });

    it('returns empty list when no dashboards exist', async () => {
      const xrm = makeXrmForDashboards([], []);
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleDashboards();
      if (result.status !== 'ok') return;
      expect(result.dashboards).toHaveLength(0);
    });

    it('caches result — second call does not re-fetch', async () => {
      const xrm = makeXrmForDashboards([SYS_DASH], []);
      const svc = new MetadataService(xrm);
      await svc.listAccessibleDashboards();
      // Second call should hit cache — mock only has one set of responses
      const result = await svc.listAccessibleDashboards();
      expect(result.status).toBe('ok');
      expect(xrm.webApiGet).toHaveBeenCalledTimes(2); // 2 calls for the first fetch (sys + user), not 4
    });

    it('invalidate clears dashboard cache', async () => {
      const xrm = {
        webApiGet: vi.fn()
          .mockResolvedValueOnce([SYS_DASH])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([SYS_DASH])
          .mockResolvedValueOnce([]),
      };
      const svc = new MetadataService(xrm);
      await svc.listAccessibleDashboards();
      svc.invalidate();
      await svc.listAccessibleDashboards();
      expect(xrm.webApiGet).toHaveBeenCalledTimes(4); // 2 per fetch × 2 fetches
    });

    it('returns error status when fetch throws', async () => {
      const xrm: Pick<IXrmContext, 'webApiGet'> = {
        webApiGet: vi.fn().mockRejectedValue(new Error('Dashboard fetch failed')),
      };
      const svc = new MetadataService(xrm);
      const result = await svc.listAccessibleDashboards();
      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(result.reason).toBe('Dashboard fetch failed');
    });
  });
});
