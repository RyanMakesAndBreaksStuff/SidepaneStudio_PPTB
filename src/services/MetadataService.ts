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
    private readonly xrm: Pick<IXrmContext, 'getCurrentUserId' | 'dataverseExecute' | 'getAllEntitiesMetadata'>
  ) {}

  async listAccessibleTables(connectionTarget?: 'primary' | 'secondary'): Promise<AccessibleTablesResult> {
    try {
      const userId = await this.xrm.getCurrentUserId();
      const cached = this._cache.get(userId);
      if (cached && Date.now() < cached.expiresAt) {
        return { status: 'ok', tables: cached.tables };
      }

      const executeRequest = {
        operationName: 'RetrieveUserPrivileges',
        operationType: 'function' as const,
        entityName: 'systemuser',
        entityId: userId,
      };
      console.log('[MetadataService] dataverseExecute request:', executeRequest, 'connectionTarget:', connectionTarget);

      const [entities, privResult] = await Promise.all([
        this.xrm.getAllEntitiesMetadata([
          'LogicalName', 'DisplayName', 'ObjectTypeCode',
          'IsIntersect', 'IsPrivate', 'Privileges',
        ], connectionTarget),
        this.xrm.dataverseExecute<{ RolePrivileges: Array<{ PrivilegeId: string; Depth: number }> }>(
          executeRequest, connectionTarget
        ),
      ]);

      console.log('[MetadataService] privResult:', privResult);
      console.log('[MetadataService] entities count:', entities.length);

      const userPrivilegeIds = new Set(
        (privResult.RolePrivileges ?? []).map((p) => normalizeGuid(p.PrivilegeId))
      );
      console.log('[MetadataService] userPrivilegeIds count:', userPrivilegeIds.size);

      const tables: TableInfo[] = [];
      for (const entity of entities) {
        if (entity.IsIntersect || entity.IsPrivate) continue;

        const writePriv = (entity.Privileges ?? []).find(
          (p: any) => typeof p.Name === 'string' && p.Name.toLowerCase().startsWith('prvwrite')
        );
        if (!writePriv?.PrivilegeId) continue;
        if (!userPrivilegeIds.has(normalizeGuid(writePriv.PrivilegeId))) continue;

        tables.push({
          logicalName: entity.LogicalName,
          displayName:
            entity.DisplayName?.UserLocalizedLabel?.Label ?? entity.LogicalName,
          objectTypeCode: entity.ObjectTypeCode ?? 0,
        });
      }

      console.log('[MetadataService] matched tables count:', tables.length);
      tables.sort((a, b) => a.displayName.localeCompare(b.displayName));
      this._cache.set(userId, { tables, expiresAt: Date.now() + CACHE_TTL_MS });
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
