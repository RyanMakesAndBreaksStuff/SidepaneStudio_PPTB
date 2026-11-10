// src/services/MetadataService.ts
import type { IXrmContext } from '../adapters/PptbContextAdapter';
import {
  DEFAULT_METADATA_FILTER_CONFIG,
  MetadataFilterConfig,
  normalizeMetadataFilterConfig,
} from '../types/MetadataFilterConfig';
import {
  buildEntityDefinitionsPath,
  buildAttributeLabelsPath,
  buildLookupAttributesPath,
  buildSystemDashboardsPath,
  buildUserDashboardsPath,
  buildViewsForEntityPath,
  isValidLogicalName,
} from './odataGuards';

export interface TableInfo {
  logicalName: string;
  displayName: string;
  objectTypeCode: number;
  isCustomEntity?: boolean;
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
  layoutXml: string;
}

export interface AttributeLabel {
  LogicalName: string;
  DisplayName?: { UserLocalizedLabel?: { Label?: string | null } | null } | null;
}

export interface LookupAttributeInfo extends AttributeLabel {
  Targets?: string[] | null;
}

/** The user-localized label, trimmed, falling back to the logical name when it is missing or blank. */
export function displayLabel(info: AttributeLabel): string {
  return info.DisplayName?.UserLocalizedLabel?.Label?.trim() || info.LogicalName;
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
  // The allowlist admits activity tables (task, email, ...); exact and prefix denies below still apply.
  if (e.IsActivity === true && !allowedStandardTables.has(logicalName)) return false;
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

/** One shared request per key until it expires; a rejected request is dropped so the next call retries. */
class RequestCache<T> {
  private readonly entries = new Map<string, { promise: Promise<T>; expiresAt: number }>();

  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && Date.now() < hit.expiresAt) return hit.promise;
    const entry = { promise: load(), expiresAt: Date.now() + CACHE_TTL_MS };
    this.entries.set(key, entry);
    entry.promise.catch(() => { if (this.entries.get(key) === entry) this.entries.delete(key); });
    return entry.promise;
  }

  clear(): void {
    this.entries.clear();
  }
}

export class MetadataService {
  private readonly _tables = new RequestCache<TableInfo[]>();
  private readonly _views = new RequestCache<ViewInfo[]>();
  private readonly _attributeLabels = new RequestCache<AttributeLabel[]>();
  private readonly _lookupAttributes = new RequestCache<LookupAttributeInfo[]>();
  private _dashboardCache?: { dashboards: DashboardInfo[]; expiresAt: number };
  private _connectionGeneration = 0;
  private _filterConfig: MetadataFilterConfig;
  private _denyExact: Set<string>;
  private _allowedStandardTables: Set<string>;
  private _tableListeners = new Set<() => void>();

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
    this._tables.clear();
    this._tableListeners.forEach(listener => listener());
  }

  /** Notifies mounted table-list consumers that a reload would return a different list. */
  subscribeTables(listener: () => void): () => void {
    this._tableListeners.add(listener);
    return () => { this._tableListeners.delete(listener); };
  }

  async listAccessibleTables(): Promise<AccessibleTablesResult> {
    const generation = this._connectionGeneration;
    try {
      const tables = await this._tables.get('all', async () => {
        const response = await this.xrm.webApiGet<RawEntityMetadata[]>(
          buildEntityDefinitionsPath()
        );
        return response
          .filter(e => keepEntity(e, this._filterConfig, this._denyExact, this._allowedStandardTables))
          .map(e => ({
            logicalName: e.LogicalName,
            displayName: displayLabel(e),
            objectTypeCode: e.ObjectTypeCode ?? 0,
            isCustomEntity: e.IsCustomEntity === true,
          }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
      });
      if (generation !== this._connectionGeneration) return this.listAccessibleTables();
      return { status: 'ok', tables };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error loading table list.';
      return { status: 'error', reason };
    }
  }

  async listAccessibleDashboards(): Promise<AccessibleDashboardsResult> {
    try {
      const cached = this._dashboardCache;
      if (cached && Date.now() < cached.expiresAt) {
        return { status: 'ok', dashboards: cached.dashboards };
      }
      const generation = this._connectionGeneration;
      const [sysResult, userResult] = await Promise.all([
        this.xrm.webApiGet<RawSystemDashboard[]>(
          buildSystemDashboardsPath()
        ),
        this.xrm.webApiGet<RawUserDashboard[]>(
          buildUserDashboardsPath()
        ),
      ]);
      if (generation !== this._connectionGeneration) return this.listAccessibleDashboards();
      const dashboards: DashboardInfo[] = [
        ...sysResult.map(d => ({ id: d.formid, name: d.name, isPersonal: false })),
        ...userResult.map(d => ({ id: d.userformid, name: d.name, isPersonal: true })),
      ].sort((a, b) => a.name.localeCompare(b.name));
      this._dashboardCache = { dashboards, expiresAt: Date.now() + CACHE_TTL_MS };
      return { status: 'ok', dashboards };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error loading dashboards.';
      return { status: 'error', reason };
    }
  }

  async listViewsForEntity(
    entityLogicalName: string
  ): Promise<ViewsForEntityResult> {
    const systemPath = buildViewsForEntityPath(entityLogicalName, 'savedquery');
    const personalPath = buildViewsForEntityPath(entityLogicalName, 'userquery');
    if (!systemPath || !personalPath) return { status: 'error', reason: 'Invalid table logical name.' };
    try {
      const views = await this._views.get(entityLogicalName, async () => {
        const [system, personal] = await Promise.all([
          this.xrm.webApiGet<{ savedqueryid: string; name: string; fetchxml: string | null; layoutxml: string | null }[]>(systemPath),
          this.xrm.webApiGet<{ userqueryid: string; name: string; fetchxml: string | null; layoutxml: string | null }[]>(personalPath),
        ]);
        const merged: ViewInfo[] = [
          ...system.map(v => ({ id: v.savedqueryid, name: v.name, viewType: 'savedquery' as const, fetchXml: v.fetchxml ?? '', layoutXml: v.layoutxml ?? '' })),
          ...personal.map(v => ({ id: v.userqueryid, name: v.name, viewType: 'userquery' as const, fetchXml: v.fetchxml ?? '', layoutXml: v.layoutxml ?? '' })),
        ];
        return merged.sort((a, b) => a.name.localeCompare(b.name));
      });
      return { status: 'ok', views };
    } catch (error) {
      return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async listAttributeLabels(
    entityLogicalName: string
  ): Promise<AttributeLabel[]> {
    const path = buildAttributeLabelsPath(entityLogicalName);
    if (!path) throw new Error('Invalid table logical name.');
    return this._attributeLabels.get(entityLogicalName, () => this.xrm.webApiGet<AttributeLabel[]>(path));
  }

  /** Lookup, customer, and owner columns — the columns whose value names a related record. */
  async listLookupAttributes(
    entityLogicalName: string
  ): Promise<LookupAttributeInfo[]> {
    const path = buildLookupAttributesPath(entityLogicalName);
    if (!path) throw new Error('Invalid table logical name.');
    return this._lookupAttributes.get(entityLogicalName, async () => {
      const lookups = await this.xrm.webApiGet<LookupAttributeInfo[]>(path);
      return lookups.map(lookup => ({
        ...lookup,
        ...(Array.isArray(lookup.Targets)
          ? { Targets: lookup.Targets.filter(isValidLogicalName) }
          : {}),
      }));
    });
  }

  invalidate(): void {
    this._connectionGeneration += 1;
    this._tables.clear();
    this._dashboardCache = undefined;
    this._views.clear();
    this._attributeLabels.clear();
    this._lookupAttributes.clear();
  }
}
