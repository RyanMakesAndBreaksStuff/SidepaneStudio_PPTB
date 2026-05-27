// src/services/MetadataService.ts
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import {
  buildEntityDefinitionsPath,
  buildSystemDashboardsPath,
  buildUserDashboardsPath,
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

const DENY_PREFIXES = [
  'adx_', 'cdm_', 'msdyn_', 'mspp_', 'workflow', 'process',
  'sdkmessage', 'solution', 'appmodule', 'ribbon', 'dependency',
  'component', 'duplicaterule',
];
const DENY_EXACT = new Set([
  'systemuser', 'team', 'businessunit', 'role', 'privilege', 'organization',
  'publisher', 'solution', 'savedquery', 'userquery', 'systemform', 'appmodule',
  'sitemap', 'webresource', 'pluginassembly', 'plugintype', 'sdkmessageprocessingstep',
  'environmentvariabledefinition', 'environmentvariablevalue',
]);
const ALLOWED_STANDARD_TABLES = new Set([
  'account', 'contact', 'lead', 'opportunity', 'incident', 'quote',
  'salesorder', 'invoice', 'task', 'phonecall', 'appointment', 'email',
]);

function keepEntity(e: RawEntityMetadata): boolean {
  const logicalName = e.LogicalName ?? '';
  const schemaName = e.SchemaName ?? '';
  if (!e.EntitySetName) return false;
  if (e.IsIntersect === true) return false;
  if (e.IsPrivate === true) return false;
  if (e.IsActivity === true) return false;
  if (e.OwnershipType === 'OrganizationOwned' && !schemaName.includes('_')) return false;
  if (DENY_EXACT.has(logicalName)) return false;
  if (DENY_PREFIXES.some(p => logicalName.startsWith(p))) return false;
  if (e.CanCreateForms?.Value === false) return false;
  if (e.CanModifyAdditionalSettings?.Value === false) return false;
  if (e.IsCustomEntity === true) return true;
  if (e.IsCustomizable?.Value === true && e.CanCreateForms?.Value !== false) return true;
  if (ALLOWED_STANDARD_TABLES.has(logicalName)) return true;
  return false;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export class MetadataService {
  private _tableCache = new Map<string, { tables: TableInfo[]; expiresAt: number }>();
  private _dashboardCache = new Map<string, { dashboards: DashboardInfo[]; expiresAt: number }>();

  constructor(
    private readonly xrm: Pick<IXrmContext, 'webApiGet'>
  ) {}

  async listAccessibleTables(
    connectionTarget?: 'primary' | 'secondary'
  ): Promise<AccessibleTablesResult> {
    try {
      const cacheKey = connectionTarget ?? 'default';
      const cached = this._tableCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return { status: 'ok', tables: cached.tables };
      }
      const response = await this.xrm.webApiGet<{ value: RawEntityMetadata[] }>(
        buildEntityDefinitionsPath(),
        connectionTarget
      );
      const tables: TableInfo[] = response.value
        .filter(keepEntity)
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
        this.xrm.webApiGet<{ value: Array<{ name: string; dashboardid: string }> }>(
          buildSystemDashboardsPath(),
          connectionTarget
        ),
        this.xrm.webApiGet<{ value: Array<{ name: string; userdashboardid: string }> }>(
          buildUserDashboardsPath(),
          connectionTarget
        ),
      ]);
      const dashboards: DashboardInfo[] = [
        ...sysResult.value.map(d => ({ id: d.dashboardid, name: d.name, isPersonal: false })),
        ...userResult.value.map(d => ({ id: d.userdashboardid, name: d.name, isPersonal: true })),
      ].sort((a, b) => a.name.localeCompare(b.name));
      this._dashboardCache.set(cacheKey, { dashboards, expiresAt: Date.now() + CACHE_TTL_MS });
      return { status: 'ok', dashboards };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error loading dashboards.';
      return { status: 'error', reason };
    }
  }

  invalidate(): void {
    this._tableCache.clear();
    this._dashboardCache.clear();
  }
}
