// src/services/MetadataService.ts
import type { IXrmContext } from '../adapters/PptbContextAdapter';

export interface TableInfo {
  logicalName: string;
  displayName: string;
  objectTypeCode: number;
}

export type AccessibleTablesResult =
  | { status: 'ok'; tables: TableInfo[] }
  | { status: 'error'; reason: string };

interface CacheEntry {
  tables: TableInfo[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export class MetadataService {
  private _cache = new Map<string, CacheEntry>();

  constructor(
    private readonly xrm: Pick<IXrmContext, 'getCurrentUserId'>
  ) {}

  async listAccessibleTables(): Promise<AccessibleTablesResult> {
    try {
      const userId = await this.xrm.getCurrentUserId();
      const cacheKey = userId;
      const cached = this._cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return { status: 'ok', tables: cached.tables };
      }

      const api = (window as any).dataverseAPI;

      const [entityMeta, privResult] = await Promise.all([
        api.getAllEntitiesMetadata([
          'LogicalName', 'DisplayName', 'ObjectTypeCode',
          'IsIntersect', 'IsPrivate', 'Privileges',
        ]) as Promise<any[]>,
        api.execute({
          RequestName: 'RetrieveUserPrivileges',
          Parameters: [{ Key: 'UserId', Value: userId }],
        }) as Promise<{ Privileges: Array<{ PrivilegeId: string; Depth: number }> }>,
      ]);

      const userPrivilegeIds = new Set(
        (privResult.Privileges ?? []).map((p: any) => normalizeGuid(p.PrivilegeId))
      );

      const tables: TableInfo[] = [];
      for (const entity of entityMeta) {
        if (entity.IsIntersect || entity.IsPrivate) continue;

        const writePriv = (entity.Privileges ?? []).find(
          (p: any) => typeof p.Name === 'string' && p.Name.toLowerCase().startsWith('prvwrite')
        );
        if (!writePriv) continue;
        if (!userPrivilegeIds.has(normalizeGuid(writePriv.PrivilegeId))) continue;

        tables.push({
          logicalName: entity.LogicalName,
          displayName:
            entity.DisplayName?.UserLocalizedLabel?.Label ?? entity.LogicalName,
          objectTypeCode: entity.ObjectTypeCode ?? 0,
        });
      }

      tables.sort((a, b) => a.displayName.localeCompare(b.displayName));
      this._cache.set(cacheKey, { tables, expiresAt: Date.now() + CACHE_TTL_MS });
      return { status: 'ok', tables };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error loading table list.';
      return { status: 'error', reason };
    }
  }

  invalidate(): void {
    this._cache.clear();
  }
}

function normalizeGuid(guid: string): string {
  return guid.toLowerCase().replace(/[{}]/g, '');
}
