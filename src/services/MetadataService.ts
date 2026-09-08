// src/services/MetadataService.ts
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import {
  DEFAULT_METADATA_FILTER_CONFIG,
  MetadataFilterConfig,
  normalizeMetadataFilterConfig,
} from '../types/MetadataFilterConfig';
import {
  buildEntityDefinitionsPath,
  buildSystemDashboardsPath,
  buildUserDashboardsPath,
  buildViewsForEntityPath,
} from './odataGuards';

export interface TableInfo {
  logicalName: string;
  displayName: string;
  objectTypeCode: number;
}

export interface DashboardInfo {
  id: string;
  name: string;
  isPersonal: boolean;
}

export interface ViewInfo {
  id: string;
  name: string;
  viewType: 'savedquery' | 'userquery';
  fetchXml: string;
}

export type ViewsForEntityResult =
  | { status: 'ok'; views: ViewInfo[] }
  | { status: 'error'; reason: string };

export type AccessibleTablesResult =
  | { status: 'ok'; tables: TableInfo[] }
  | { status: 'error'; reason: string };

export type AccessibleDashboardsResult =
  | { status: 'ok'; dashboards: DashboardInfo[] }
  | { status: 'error'; reason: string };

interface RawEntityMetadata {
  LogicalName: string;
  SchemaName: string;
  DisplayName?: { UserLocalizedLabel?: { Label: string } | null } | null;
  EntitySetName?: string | null;
  ObjectTypeCode?: number | null;
  IsCustomEntity?: boolean;
  IsActivity?: boolean;
  IsIntersect?: boolean;
  IsPrivate?: boolean;
  OwnershipType?: string;
  CanCreateForms?: { Value: boolean };
  CanModifyAdditionalSettings?: { Value: boolean };
  IsCustomizable?: { Value: boolean };
}

interface RawSystemDashboard {
  name: string;
  formid: string;
}

interface RawUserDashboard {
  name: string;
  userformid: string;
}

function keepEntity(
  e: RawEntityMetadata,
  config: MetadataFilterConfig,
  denyExact: Set<string>,
  allowedStandardTables: Set<string>
): boolean {
  const logicalName = e.LogicalName ?? '';
  const schemaName = e.SchemaName ?? '';
  if (!e.EntitySetName) return false;
  if (e.IsIntersect === true) return false;
  if (e.IsPrivate === true) return false;
  if (e.IsActivity === true) return false;
  if (e.OwnershipType === 'OrganizationOwned' && !schemaName.includes('_')) return false;
  if (denyExact.has(logicalName)) return false;
  if (config.denyPrefixes.some(p => logicalName.startsWith(p))) return false;
  if (e.CanCreateForms?.Value === false) return false;
  if (e.CanModifyAdditionalSettings?.Value === false) return false;
  if (e.IsCustomEntity === true) return true;
  if (e.IsCustomizable?.Value === true) return true;
  if (allowedStandardTables.has(logicalName)) return true;
  return false;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export class MetadataService {
  private _tableCache = new Map<string, { tables: TableInfo[]; expiresAt: number }>();
  private _dashboardCache = new Map<string, { dashboards: DashboardInfo[]; expiresAt: number }>();
  private _filterConfig: MetadataFilterConfig;
  private _denyExact: Set<string>;
  private _allowedStandardTables: Set<string>;

  constructor(
    private readonly xrm: Pick<IXrmContext, 'webApiGet'>,
    filterConfig: MetadataFilterConfig = DEFAULT_METADATA_FILTER_CONFIG
  ) {
    this._filterConfig = normalizeMetadataFilterConfig(filterConfig);
    this._denyExact = new Set(this._filterConfig.denyExact);
    this._allowedStandardTables = new Set(this._filterConfig.allowedStandardTables);
  }

  setFilterConfig(filterConfig: MetadataFilterConfig): void {
    this._filterConfig = normalizeMetadataFilterConfig(filterConfig);
    this._denyExact = new Set(this._filterConfig.denyExact);
    this._allowedStandardTables = new Set(this._filterConfig.allowedStandardTables);
    this._tableCache.clear();
  }

  async listAccessibleTables(
    connectionTarget?: 'primary' | 'secondary'
  ): Promise<AccessibleTablesResult> {
    try {
      const cacheKey = connectionTarget ?? 'default';
      const cached = this._tableCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return { status: 'ok', tables: cached.tables };
      }
      const response = await this.xrm.webApiGet<RawEntityMetadata[]>(
        buildEntityDefinitionsPath(),
        connectionTarget
      );
      const tables: TableInfo[] = response
        .filter(e => keepEntity(e, this._filterConfig, this._denyExact, this._allowedStandardTables))
        .map(e => ({
          logicalName: e.LogicalName,
          displayName: e.DisplayName?.UserLocalizedLabel?.Label ?? e.LogicalName,
          objectTypeCode: e.ObjectTypeCode ?? 0,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      this._tableCache.set(cacheKey, { tables, expiresAt: Date.now() + CACHE_TTL_MS });
      return { status: 'ok', tables };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error loading table list.';
      return { status: 'error', reason };
    }
  }

  async listAccessibleDashboards(
    connectionTarget?: 'primary' | 'secondary'
  ): Promise<AccessibleDashboardsResult> {
    try {
      const cacheKey = `dashboards:${connectionTarget ?? 'default'}`;
      const cached = this._dashboardCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return { status: 'ok', dashboards: cached.dashboards };
      }
      const [sysResult, userResult] = await Promise.all([
        this.xrm.webApiGet<RawSystemDashboard[]>(
          buildSystemDashboardsPath(),
          connectionTarget
        ),
        this.xrm.webApiGet<RawUserDashboard[]>(
          buildUserDashboardsPath(),
          connectionTarget
        ),
      ]);
      const dashboards: DashboardInfo[] = [
        ...sysResult.map(d => ({ id: d.formid, name: d.name, isPersonal: false })),
        ...userResult.map(d => ({ id: d.userformid, name: d.name, isPersonal: true })),
      ].sort((a, b) => a.name.localeCompare(b.name));
      this._dashboardCache.set(cacheKey, { dashboards, expiresAt: Date.now() + CACHE_TTL_MS });
      return { status: 'ok', dashboards };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error loading dashboards.';
      return { status: 'error', reason };
    }
  }

  async listViewsForEntity(
    entityLogicalName: string,
    connectionTarget?: 'primary' | 'secondary'
  ): Promise<ViewsForEntityResult> {
    const systemPath = buildViewsForEntityPath(entityLogicalName, 'savedquery');
    const personalPath = buildViewsForEntityPath(entityLogicalName, 'userquery');
    if (!systemPath || !personalPath) return { status: 'error', reason: 'Invalid table logical name.' };
    try {
      const [system, personal] = await Promise.all([
        this.xrm.webApiGet<{ savedqueryid: string; name: string; fetchxml: string | null }[]>(systemPath, connectionTarget),
        this.xrm.webApiGet<{ userqueryid: string; name: string; fetchxml: string | null }[]>(personalPath, connectionTarget),
      ]);
      const views: ViewInfo[] = [
        ...system.map(v => ({ id: v.savedqueryid, name: v.name, viewType: 'savedquery' as const, fetchXml: v.fetchxml ?? '' })),
        ...personal.map(v => ({ id: v.userqueryid, name: v.name, viewType: 'userquery' as const, fetchXml: v.fetchxml ?? '' })),
      ];
      views.sort((a, b) => a.name.localeCompare(b.name));
      return { status: 'ok', views };
    } catch (error) {
      return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
  }

  invalidate(): void {
    this._tableCache.clear();
    this._dashboardCache.clear();
  }
}
