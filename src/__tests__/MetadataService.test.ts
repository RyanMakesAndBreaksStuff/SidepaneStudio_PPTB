import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataService } from '../services/MetadataService';
import { buildViewsForEntityPath } from '../services/odataGuards';
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

    it('discards and retries tables fetched before invalidation', async () => {
      let resolveOld!: (value: typeof ENTITY_ACCOUNT[]) => void;
      const oldResponse = new Promise<typeof ENTITY_ACCOUNT[]>(resolve => { resolveOld = resolve; });
      const webApiGet = vi.fn().mockReturnValueOnce(oldResponse).mockResolvedValueOnce([ENTITY_CUSTOM]);
      const svc = new MetadataService({ webApiGet });
      const pending = svc.listAccessibleTables();
      svc.invalidate();
      resolveOld([ENTITY_ACCOUNT]);
      const result = await pending;
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.tables.map(table => table.logicalName)).toEqual(['new_widget']);
      expect(webApiGet).toHaveBeenCalledTimes(2);
      await svc.listAccessibleTables();
      expect(webApiGet).toHaveBeenCalledTimes(2);
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

    it('discards and retries dashboards fetched before invalidation', async () => {
      let resolveOldSystem!: (value: typeof SYS_DASH[]) => void;
      let resolveOldUser!: (value: typeof USER_DASH[]) => void;
      const oldSystem = new Promise<typeof SYS_DASH[]>(resolve => { resolveOldSystem = resolve; });
      const oldUser = new Promise<typeof USER_DASH[]>(resolve => { resolveOldUser = resolve; });
      const webApiGet = vi.fn()
        .mockReturnValueOnce(oldSystem)
        .mockReturnValueOnce(oldUser)
        .mockResolvedValueOnce([{ name: 'Current Dashboard', formid: 'current' }])
        .mockResolvedValueOnce([]);
      const svc = new MetadataService({ webApiGet });
      const pending = svc.listAccessibleDashboards();
      svc.invalidate();
      resolveOldSystem([SYS_DASH]);
      resolveOldUser([USER_DASH]);
      const result = await pending;
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.dashboards.map(dashboard => dashboard.id)).toEqual(['current']);
      expect(webApiGet).toHaveBeenCalledTimes(4);
      await svc.listAccessibleDashboards();
      expect(webApiGet).toHaveBeenCalledTimes(4);
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

  describe('cache lifetime', () => {
    const SYS_DASH = { name: 'Sales Dashboard', formid: 'sys-1' };
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const start = 1700000000000;

    it('reuses the same table array until five minutes and refetches when expiry is equal', async () => {
      const now = vi.spyOn(Date, 'now');
      try {
        now.mockReturnValue(start);
        const xrm = makeXrm([ENTITY_ACCOUNT, ENTITY_CUSTOM]);
        const svc = new MetadataService(xrm);

        const first = await svc.listAccessibleTables();
        expect(first.status).toBe('ok');
        if (first.status !== 'ok') return;

        now.mockReturnValue(start + FIVE_MINUTES_MS - 1);
        const cached = await svc.listAccessibleTables();
        expect(cached.status).toBe('ok');
        if (cached.status !== 'ok') return;
        expect(cached.tables).toBe(first.tables);
        expect(xrm.webApiGet).toHaveBeenCalledTimes(1);

        now.mockReturnValue(start + FIVE_MINUTES_MS);
        const expired = await svc.listAccessibleTables();
        expect(expired.status).toBe('ok');
        if (expired.status !== 'ok') return;
        expect(expired.tables).not.toBe(first.tables);
        expect(expired.tables.map(table => table.logicalName)).toEqual(
          first.tables.map(table => table.logicalName)
        );
        expect(xrm.webApiGet).toHaveBeenCalledTimes(2);
      } finally {
        now.mockRestore();
      }
    });

    it('reuses the same dashboard array until five minutes and refetches when expiry is equal', async () => {
      const now = vi.spyOn(Date, 'now');
      try {
        now.mockReturnValue(start);
        const webApiGet = vi.fn()
          .mockResolvedValueOnce([SYS_DASH])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([SYS_DASH])
          .mockResolvedValueOnce([]);
        const svc = new MetadataService({ webApiGet });

        const first = await svc.listAccessibleDashboards();
        expect(first.status).toBe('ok');
        if (first.status !== 'ok') return;

        now.mockReturnValue(start + FIVE_MINUTES_MS - 1);
        const cached = await svc.listAccessibleDashboards();
        expect(cached.status).toBe('ok');
        if (cached.status !== 'ok') return;
        expect(cached.dashboards).toBe(first.dashboards);
        expect(webApiGet).toHaveBeenCalledTimes(2);

        now.mockReturnValue(start + FIVE_MINUTES_MS);
        const expired = await svc.listAccessibleDashboards();
        expect(expired.status).toBe('ok');
        if (expired.status !== 'ok') return;
        expect(expired.dashboards).not.toBe(first.dashboards);
        expect(webApiGet).toHaveBeenCalledTimes(4);
      } finally {
        now.mockRestore();
      }
    });

    it('setFilterConfig clears only the table cache and notifies table listeners', async () => {
      const webApiGet = vi.fn()
        .mockResolvedValueOnce([ENTITY_ACCOUNT])
        .mockResolvedValueOnce([SYS_DASH])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const svc = new MetadataService({ webApiGet });
      const tables = await svc.listAccessibleTables();
      const dashboards = await svc.listAccessibleDashboards();
      expect(tables.status).toBe('ok');
      expect(dashboards.status).toBe('ok');
      if (tables.status !== 'ok' || dashboards.status !== 'ok') return;

      let notifiedReload: ReturnType<MetadataService['listAccessibleTables']> | undefined;
      svc.subscribeTables(() => {
        notifiedReload = svc.listAccessibleTables();
      });
      svc.setFilterConfig({
        ...DEFAULT_METADATA_FILTER_CONFIG,
        denyExact: [...DEFAULT_METADATA_FILTER_CONFIG.denyExact, 'account'],
      });

      expect(notifiedReload).toBeDefined();
      if (!notifiedReload) return;
      const reloaded = await notifiedReload;
      const dashboardsAgain = await svc.listAccessibleDashboards();
      expect(reloaded.status).toBe('ok');
      expect(dashboardsAgain.status).toBe('ok');
      if (reloaded.status !== 'ok' || dashboardsAgain.status !== 'ok') return;
      expect(reloaded.tables).toHaveLength(0);
      expect(reloaded.tables).not.toBe(tables.tables);
      expect(dashboardsAgain.dashboards).toBe(dashboards.dashboards);
      expect(webApiGet).toHaveBeenCalledTimes(4);
    });

    it('invalidate clears both caches and advances the generation', async () => {
      let resolveOldTables!: (value: typeof ENTITY_ACCOUNT[]) => void;
      const oldTables = new Promise<typeof ENTITY_ACCOUNT[]>(resolve => { resolveOldTables = resolve; });
      const webApiGet = vi.fn()
        .mockResolvedValueOnce([ENTITY_ACCOUNT])
        .mockResolvedValueOnce([SYS_DASH])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([ENTITY_ACCOUNT])
        .mockResolvedValueOnce([SYS_DASH])
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(oldTables)
        .mockResolvedValueOnce([ENTITY_CUSTOM]);
      const svc = new MetadataService({ webApiGet });

      const primedTables = await svc.listAccessibleTables();
      const primedDashboards = await svc.listAccessibleDashboards();
      expect(primedTables.status).toBe('ok');
      expect(primedDashboards.status).toBe('ok');
      if (primedTables.status !== 'ok' || primedDashboards.status !== 'ok') return;

      svc.invalidate();
      const tablesAfter = await svc.listAccessibleTables();
      const dashboardsAfter = await svc.listAccessibleDashboards();
      expect(tablesAfter.status).toBe('ok');
      expect(dashboardsAfter.status).toBe('ok');
      if (tablesAfter.status !== 'ok' || dashboardsAfter.status !== 'ok') return;
      expect(tablesAfter.tables).not.toBe(primedTables.tables);
      expect(dashboardsAfter.dashboards).not.toBe(primedDashboards.dashboards);
      expect(webApiGet).toHaveBeenCalledTimes(6);

      svc.invalidate();
      const pending = svc.listAccessibleTables();
      svc.invalidate();
      resolveOldTables([ENTITY_ACCOUNT]);
      const retried = await pending;
      expect(retried.status).toBe('ok');
      if (retried.status !== 'ok') return;
      expect(retried.tables.map(table => table.logicalName)).toEqual(['new_widget']);
      await svc.listAccessibleTables();
      expect(webApiGet).toHaveBeenCalledTimes(8);
    });
  });
});

describe('view metadata', () => {
  it('merges system and personal views with their query source and XML', async () => {
    const webApiGet = vi.fn()
      .mockResolvedValueOnce([{
        savedqueryid: 'aaaaaaaa-0000-0000-0000-000000000001',
        name: 'System accounts', fetchxml: '<fetch><entity name="account"/></fetch>',
      }])
      .mockResolvedValueOnce([{
        userqueryid: 'bbbbbbbb-0000-0000-0000-000000000002',
        name: 'My accounts', fetchxml: '<fetch top="3"><entity name="account"/></fetch>',
      }]);
    const result = await new MetadataService({ webApiGet }).listViewsForEntity('account');
    expect(webApiGet.mock.calls).toEqual([
      ["savedqueries?$select=name,savedqueryid,fetchxml,layoutxml&$filter=returnedtypecode eq 'account' and querytype eq 0&$orderby=name asc"],
      ["userqueries?$select=name,userqueryid,fetchxml,layoutxml&$filter=returnedtypecode eq 'account' and querytype eq 0&$orderby=name asc"],
    ]);
    expect(result).toEqual({ status: 'ok', views: [
      { id: 'bbbbbbbb-0000-0000-0000-000000000002', name: 'My accounts', viewType: 'userquery', fetchXml: '<fetch top="3"><entity name="account"/></fetch>', layoutXml: '' },
      { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'System accounts', viewType: 'savedquery', fetchXml: '<fetch><entity name="account"/></fetch>', layoutXml: '' },
    ] });
  });

  it('retrieves attribute labels through the guarded metadata endpoint', async () => {
    const labels = [{ LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Account Name' } } }];
    const webApiGet = vi.fn().mockResolvedValue(labels);
    const service = new MetadataService({ webApiGet });
    expect(await service.listAttributeLabels('account')).toEqual(labels);
    expect(webApiGet).toHaveBeenCalledWith(
      "EntityDefinitions(LogicalName='account')/Attributes?$select=LogicalName,DisplayName");
    await expect(service.listAttributeLabels("account'bad")).rejects.toThrow('Invalid table logical name.');
    expect(webApiGet).toHaveBeenCalledTimes(1);
  });

  it('retrieves lookup columns through the guarded metadata cast endpoint', async () => {
    const lookups = [{ LogicalName: 'primarycontactid', DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } } }];
    const webApiGet = vi.fn().mockResolvedValue(lookups);
    const service = new MetadataService({ webApiGet });
    expect(await service.listLookupAttributes('account')).toEqual(lookups);
    expect(webApiGet).toHaveBeenCalledWith(
      "EntityDefinitions(LogicalName='account')/Attributes/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=LogicalName,DisplayName");
    await expect(service.listLookupAttributes("account'bad")).rejects.toThrow('Invalid table logical name.');
    expect(webApiGet).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid logical names before making either request', async () => {
    const webApiGet = vi.fn();
    const service = new MetadataService({ webApiGet });
    for (const entity of ['', "account' or true", 'account/contacts']) {
      expect(buildViewsForEntityPath(entity, 'savedquery')).toBeNull();
      expect(await service.listViewsForEntity(entity)).toEqual({ status: 'error', reason: 'Invalid table logical name.' });
    }
    expect(webApiGet).not.toHaveBeenCalled();
  });

  it('distinguishes an empty result from a failed query', async () => {
    const empty = new MetadataService({ webApiGet: vi.fn().mockResolvedValue([]) });
    expect(await empty.listViewsForEntity('account')).toEqual({ status: 'ok', views: [] });
    const failed = new MetadataService({ webApiGet: vi.fn().mockRejectedValue(new Error('Access denied')) });
    expect(await failed.listViewsForEntity('account')).toEqual({ status: 'error', reason: 'Access denied' });
  });
});
