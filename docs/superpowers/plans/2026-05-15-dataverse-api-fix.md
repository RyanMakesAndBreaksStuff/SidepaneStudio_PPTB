# Dataverse API Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Dataverse API contract violations and connection management gaps that cause "No connection found for this tool instance" and silent data failures in the PPTB-hosted Side Pane Studio tool.

**Architecture:** Expand `IXrmContext` with `dataverseExecute` and `getAllEntitiesMetadata` methods so `MetadataService` no longer reaches `window.dataverseAPI` directly; fix all PPTB API call formats (Xrm SDK style → PPTB style); add async connection guard and reactive event subscription. Tests follow the fixed contracts throughout.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, Power Platform Toolbox (PPTB) `window.dataverseAPI` / `window.toolboxAPI` bridge APIs.

**Parallel Execution Map:**
```
Phase 1 (parallel):  Task 1 ──┐
                     Task 2 ──┤
                               ↓
Phase 2 (sequential): Task 3 (depends on Task 1 expanded IXrmContext)
                               ↓
Phase 3 (sequential): Task 4 (depends on Tasks 1–3)
```

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/adapters/PptbContextAdapter.ts` | **Modify** | Add `DataverseExecuteRequest` type; add `dataverseExecute`, `getAllEntitiesMetadata` to `IXrmContext`; fix `execute()` call format; lazy-init WhoAmI; fix `webApiGet` envelope; add `resetUserId()` |
| `src/SidePaneBuilderWorkbench.tsx` | **Modify** | Async connection guard with loading/error states; subscribe to `connection:updated/created/deleted` events; invalidate adapter + cache on reconnect |
| `src/services/MetadataService.ts` | **Modify** | Remove `window.dataverseAPI` direct access; route through `IXrmContext`; fix `execute` params; fix `getAllEntitiesMetadata` call |
| `src/__tests__/PptbContextAdapter.test.ts` | **Modify** | Fix `execute` call assertions to PPTB format; add tests for `dataverseExecute`, `getAllEntitiesMetadata` unwrap, lazy WhoAmI |
| `src/__tests__/MetadataService.test.ts` | **Modify** | Remove `window.dataverseAPI` global stubs; inject mock IXrmContext; fix `getAllEntitiesMetadata` mock return shape |

---

## Task 1: Fix PptbContextAdapter — IXrmContext, execute format, lazy WhoAmI, webApiGet, new methods

**Files:**
- Modify: `src/adapters/PptbContextAdapter.ts`

**Context:** Three PPTB API contracts are broken here. (1) `execute()` uses Xrm SDK format `{ RequestName }` instead of PPTB format `{ operationName, operationType }`. (2) WhoAmI fires eagerly in the constructor — if no connection exists at construction time, the promise is permanently poisoned. (3) `webApiGet` calls `queryData` which returns `{ value: T[] }` but doesn't unwrap the envelope. Two new IXrmContext methods (`dataverseExecute`, `getAllEntitiesMetadata`) are needed so MetadataService can stop reaching into `window.dataverseAPI` directly.

- [ ] **Step 1: Replace the full file contents**

```typescript
// src/adapters/PptbContextAdapter.ts

export interface PaneCreateOptions {
  paneId: string;
  title?: string;
  width?: number;
  canClose?: boolean;
  isResizable?: boolean;
  hideHeader?: boolean;
  imageSrc?: string;
  alwaysRender?: boolean;
  keepBadgeOnSelect?: boolean;
  isSelected?: boolean;
}

export interface AppSidePane {
  select(): void;
  close(): void;
  navigate(pageInput: object): Promise<void>;
  badge: number;
}

export interface DataverseExecuteRequest {
  operationName: string;
  operationType: 'action' | 'function';
  entityName?: string;
  entityId?: string;
  parameters?: Record<string, unknown>;
}

export interface IXrmContext {
  isAvailable: boolean;
  sidePanesAvailable: boolean;
  createPane(options: PaneCreateOptions): Promise<AppSidePane>;
  getPane(paneId: string): AppSidePane | undefined;
  getHostKind(): 'SingleSession' | 'MultiSession' | 'Unknown';
  checkWebResourceExists(name: string): Promise<boolean>;
  readEnvVar(name: string): Promise<string | null>;
  getCurrentAppId(): string | null;
  getCurrentUserId(): Promise<string>;
  webApiGet<T = unknown>(path: string): Promise<T>;
  dataverseExecute<T = unknown>(request: DataverseExecuteRequest): Promise<T>;
  getAllEntitiesMetadata(properties: string[]): Promise<any[]>;
}

export class PptbContextAdapter implements IXrmContext {
  readonly isAvailable = false;
  readonly sidePanesAvailable = false;

  private _whoAmIPromise: Promise<string> | null = null;

  async createPane(_options: PaneCreateOptions): Promise<never> {
    throw new Error('Side pane creation is not available in the PPTB context.');
  }

  getPane(_paneId: string): undefined {
    return undefined;
  }

  getHostKind(): 'Unknown' {
    return 'Unknown';
  }

  async checkWebResourceExists(_name: string): Promise<boolean> {
    return true;
  }

  async readEnvVar(_name: string): Promise<null> {
    return null;
  }

  getCurrentAppId(): null {
    return null;
  }

  getCurrentUserId(): Promise<string> {
    if (!this._whoAmIPromise) {
      this._whoAmIPromise = this.dataverseExecute<{ UserId: string }>({
        operationName: 'WhoAmI',
        operationType: 'function',
      }).then(r => r.UserId);
    }
    return this._whoAmIPromise;
  }

  resetUserId(): void {
    this._whoAmIPromise = null;
  }

  async webApiGet<T = unknown>(odataPath: string): Promise<T> {
    const cleanPath = odataPath.replace(/^\/api\/data\/v\d+\.\d+\//, '');
    const result = await (window as any).dataverseAPI.queryData(cleanPath) as { value: T };
    return result.value;
  }

  async dataverseExecute<T = unknown>(request: DataverseExecuteRequest): Promise<T> {
    const payload: Record<string, unknown> = {
      operationName: request.operationName,
      operationType: request.operationType,
    };
    if (request.entityName !== undefined) payload.entityName = request.entityName;
    if (request.entityId !== undefined) payload.entityId = request.entityId;
    if (request.parameters !== undefined) payload.parameters = request.parameters;
    return (window as any).dataverseAPI.execute(payload) as Promise<T>;
  }

  async getAllEntitiesMetadata(properties: string[]): Promise<any[]> {
    const result = await (window as any).dataverseAPI.getAllEntitiesMetadata(properties) as { value: any[] };
    return result.value;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```
npx tsc --noEmit
```

Expected: no errors. If errors appear, fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/adapters/PptbContextAdapter.ts
git commit -m "fix(adapter): PPTB execute format, lazy WhoAmI, webApiGet envelope unwrap, add dataverseExecute/getAllEntitiesMetadata"
```

---

## Task 2: Add async connection guard and event subscription to SidePaneBuilderWorkbench

**Files:**
- Modify: `src/SidePaneBuilderWorkbench.tsx`

**Context:** The PPTB error "No connection found for this tool instance" fires because API calls happen before a connection is established. `toolboxAPI.connections.getActiveConnection()` must be awaited before mounting the workbench UI. Connection change events (`connection:updated`, `connection:created`, `connection:deleted`) must invalidate the metadata cache and reset the userId cache in the adapter.

- [ ] **Step 1: Replace the full file contents**

```typescript
import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { PaneDefinitionConfig, DEFAULT_CONFIG } from './types/PaneDefinitionConfig';
import { WorkbenchShell } from './components/WorkbenchShell';
import { PptbContextAdapter } from './adapters/PptbContextAdapter';
import { MetadataService } from './services/MetadataService';

type ConnectionState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export function SidePaneBuilderWorkbench(): React.ReactElement {
  const [config, setConfig] = useState<PaneDefinitionConfig>(DEFAULT_CONFIG);
  const [layoutMode, setLayoutMode] = useState<'wide' | 'narrow'>(
    window.innerWidth >= 900 ? 'wide' : 'narrow'
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'loading' });

  const adapterRef = useRef<PptbContextAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = new PptbContextAdapter();

  const metaRef = useRef<MetadataService | null>(null);
  if (!metaRef.current) metaRef.current = new MetadataService(adapterRef.current);

  // Verify active connection before allowing API calls
  useEffect(() => {
    const toolbox = (window as any).toolboxAPI;
    if (!toolbox) {
      setConnectionState({ status: 'error', message: 'toolboxAPI unavailable — open inside PPTB.' });
      return;
    }
    toolbox.connections.getActiveConnection().then((conn: unknown) => {
      setConnectionState(conn ? { status: 'ready' } : {
        status: 'error',
        message: 'No active Dataverse connection. Connect an environment in PPTB and retry.',
      });
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to check connection.';
      setConnectionState({ status: 'error', message });
    });
  }, []);

  // Subscribe to connection lifecycle events — invalidate caches on change
  useEffect(() => {
    const toolbox = (window as any).toolboxAPI;
    if (!toolbox) return;

    const handler = (event: string) => {
      if (event === 'connection:updated' || event === 'connection:created') {
        adapterRef.current?.resetUserId();
        metaRef.current?.invalidate();
        setConnectionState({ status: 'ready' });
      } else if (event === 'connection:deleted') {
        adapterRef.current?.resetUserId();
        metaRef.current?.invalidate();
        setConnectionState({ status: 'error', message: 'Connection removed. Reconnect in PPTB.' });
      }
    };

    const unsub = toolbox.events.on(handler);
    return () => { unsub?.(); };
  }, []);

  // Responsive layout via ResizeObserver
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setLayoutMode(window.innerWidth >= 900 ? 'wide' : 'narrow');
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  // Restore last config from PPTB settings on mount
  useEffect(() => {
    const toolbox = (window as any).toolboxAPI;
    if (!toolbox) return;
    toolbox.settings.get('lastConfig').then((raw: string | null) => {
      if (!raw) return;
      try {
        setConfig(JSON.parse(raw) as PaneDefinitionConfig);
      } catch {
        // corrupted stored config — ignore
      }
    });
  }, []);

  // Persist config to PPTB settings, debounced 500ms
  useEffect(() => {
    const toolbox = (window as any).toolboxAPI;
    if (!toolbox) return;
    const id = setTimeout(() => {
      toolbox.settings.set('lastConfig', JSON.stringify(config));
    }, 500);
    return () => clearTimeout(id);
  }, [config]);

  const handleChange = useCallback(
    (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => {
      setConfig(prev => updater(prev));
    },
    []
  );

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    const toolbox = (window as any).toolboxAPI;
    toolbox?.settings?.set('lastConfig', null);
  }, []);

  if (connectionState.status === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: '#1A1A1A', color: '#808080', fontSize: 13,
      }}>
        Connecting to Dataverse…
      </div>
    );
  }

  if (connectionState.status === 'error') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: '#1A1A1A', color: '#E8E8E8',
        flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>⚠</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Connection unavailable</div>
        <div style={{ fontSize: 13, color: '#808080', maxWidth: 360, textAlign: 'center' }}>
          {connectionState.message}
        </div>
      </div>
    );
  }

  return (
    <WorkbenchShell
      config={config}
      onChange={handleChange}
      onReset={handleReset}
      xrm={adapterRef.current}
      layoutMode={layoutMode}
      metadataService={metaRef.current}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/SidePaneBuilderWorkbench.tsx
git commit -m "fix(workbench): async connection guard, PPTB event subscription, cache invalidation on reconnect"
```

---

## Task 3: Fix MetadataService — remove window.dataverseAPI, route through IXrmContext, fix call formats

**Files:**
- Modify: `src/services/MetadataService.ts`

**Context:** MetadataService currently bypasses the adapter by reaching `window.dataverseAPI` directly. It also uses the wrong Xrm SDK call format for `execute`, and doesn't unwrap the `{ value: [] }` envelope from `getAllEntitiesMetadata`. This task requires Task 1 to be complete because it uses the new `dataverseExecute` and `getAllEntitiesMetadata` methods added to `IXrmContext`.

**Prerequisite:** Task 1 must be merged before starting this task.

- [ ] **Step 1: Replace the full file contents**

```typescript
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

  async listAccessibleTables(): Promise<AccessibleTablesResult> {
    try {
      const userId = await this.xrm.getCurrentUserId();
      const cached = this._cache.get(userId);
      if (cached && Date.now() < cached.expiresAt) {
        return { status: 'ok', tables: cached.tables };
      }

      const [entities, privResult] = await Promise.all([
        this.xrm.getAllEntitiesMetadata([
          'LogicalName', 'DisplayName', 'ObjectTypeCode',
          'IsIntersect', 'IsPrivate', 'Privileges',
        ]),
        this.xrm.dataverseExecute<{ Privileges: Array<{ PrivilegeId: string; Depth: number }> }>({
          operationName: 'RetrieveUserPrivileges',
          operationType: 'function',
          parameters: { UserId: userId },
        }),
      ]);

      const userPrivilegeIds = new Set(
        (privResult.Privileges ?? []).map((p) => normalizeGuid(p.PrivilegeId))
      );

      const tables: TableInfo[] = [];
      for (const entity of entities) {
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
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/MetadataService.ts
git commit -m "fix(metadata): route through IXrmContext, fix PPTB execute params, remove window.dataverseAPI access"
```

---

## Task 4: Fix all tests to match corrected contracts

**Files:**
- Modify: `src/__tests__/PptbContextAdapter.test.ts`
- Modify: `src/__tests__/MetadataService.test.ts`

**Context:** Tests currently validate the broken behavior — wrong `execute` call format, wrong `getAllEntitiesMetadata` return shape, and global `window.dataverseAPI` stubs in MetadataService tests. This task fixes all of that and adds tests for the new `dataverseExecute`, `getAllEntitiesMetadata` unwrap, lazy WhoAmI, and `resetUserId` behaviors.

**Prerequisite:** Tasks 1, 2, 3 must be complete.

- [ ] **Step 1: Replace PptbContextAdapter.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PptbContextAdapter } from '../adapters/PptbContextAdapter';

function makeMockDataverseAPI(userId = 'user-abc-123') {
  return {
    execute: vi.fn().mockResolvedValue({ UserId: userId }),
    queryData: vi.fn().mockResolvedValue({ value: [] }),
    getAllEntitiesMetadata: vi.fn().mockResolvedValue({ value: [] }),
  };
}

describe('PptbContextAdapter', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('isAvailable and sidePanesAvailable are false', () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(adapter.isAvailable).toBe(false);
    expect(adapter.sidePanesAvailable).toBe(false);
  });

  it('getCurrentUserId resolves via WhoAmI using PPTB execute format', async () => {
    const api = makeMockDataverseAPI('user-xyz');
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const id = await adapter.getCurrentUserId();
    expect(id).toBe('user-xyz');
    expect(api.execute).toHaveBeenCalledWith({
      operationName: 'WhoAmI',
      operationType: 'function',
    });
  });

  it('getCurrentUserId caches WhoAmI — only one execute call', async () => {
    const api = makeMockDataverseAPI('user-xyz');
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const id1 = await adapter.getCurrentUserId();
    const id2 = await adapter.getCurrentUserId();
    expect(id1).toBe('user-xyz');
    expect(id2).toBe('user-xyz');
    expect(api.execute).toHaveBeenCalledTimes(1);
  });

  it('WhoAmI is lazy — no execute call before getCurrentUserId is called', () => {
    const api = makeMockDataverseAPI();
    vi.stubGlobal('dataverseAPI', api);
    new PptbContextAdapter(); // construction only
    expect(api.execute).not.toHaveBeenCalled();
  });

  it('resetUserId clears cache — next call re-fetches WhoAmI', async () => {
    const api = makeMockDataverseAPI('user-xyz');
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.getCurrentUserId();
    adapter.resetUserId();
    await adapter.getCurrentUserId();
    expect(api.execute).toHaveBeenCalledTimes(2);
  });

  it('dataverseExecute passes PPTB format to window.dataverseAPI.execute', async () => {
    const api = makeMockDataverseAPI();
    api.execute.mockResolvedValue({ Privileges: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.dataverseExecute({
      operationName: 'RetrieveUserPrivileges',
      operationType: 'function',
      parameters: { UserId: 'user-123' },
    });
    expect(api.execute).toHaveBeenCalledWith({
      operationName: 'RetrieveUserPrivileges',
      operationType: 'function',
      parameters: { UserId: 'user-123' },
    });
  });

  it('dataverseExecute omits optional fields when not provided', async () => {
    const api = makeMockDataverseAPI();
    api.execute.mockResolvedValue({ UserId: 'u' });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.dataverseExecute({ operationName: 'WhoAmI', operationType: 'function' });
    expect(api.execute).toHaveBeenCalledWith({
      operationName: 'WhoAmI',
      operationType: 'function',
    });
  });

  it('getAllEntitiesMetadata unwraps value array', async () => {
    const api = makeMockDataverseAPI();
    api.getAllEntitiesMetadata.mockResolvedValue({ value: [{ LogicalName: 'account' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const result = await adapter.getAllEntitiesMetadata(['LogicalName']);
    expect(result).toEqual([{ LogicalName: 'account' }]);
    expect(api.getAllEntitiesMetadata).toHaveBeenCalledWith(['LogicalName']);
  });

  it('getAllEntitiesMetadata returns empty array when value is empty', async () => {
    const api = makeMockDataverseAPI();
    api.getAllEntitiesMetadata.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const result = await adapter.getAllEntitiesMetadata(['LogicalName']);
    expect(result).toEqual([]);
  });

  it('createPane throws', async () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    await expect(adapter.createPane({ paneId: 'x' })).rejects.toThrow();
  });

  it('getPane returns undefined', () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(adapter.getPane('any')).toBeUndefined();
  });

  it('getHostKind returns Unknown', () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(adapter.getHostKind()).toBe('Unknown');
  });

  it('checkWebResourceExists always resolves true', async () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(await adapter.checkWebResourceExists('anything')).toBe(true);
  });

  it('readEnvVar always resolves null', async () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(await adapter.readEnvVar('MY_VAR')).toBeNull();
  });

  it('getCurrentAppId returns null', () => {
    vi.stubGlobal('dataverseAPI', makeMockDataverseAPI());
    const adapter = new PptbContextAdapter();
    expect(adapter.getCurrentAppId()).toBeNull();
  });

  it('webApiGet strips /api/data/vN.N/ prefix and unwraps value', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [{ name: 'Acme' }] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    const result = await adapter.webApiGet('/api/data/v9.2/accounts?$select=name');
    expect(api.queryData).toHaveBeenCalledWith('accounts?$select=name');
    expect(result).toEqual([{ name: 'Acme' }]);
  });

  it('webApiGet passes path unchanged when no prefix', async () => {
    const api = makeMockDataverseAPI();
    api.queryData.mockResolvedValue({ value: [] });
    vi.stubGlobal('dataverseAPI', api);
    const adapter = new PptbContextAdapter();
    await adapter.webApiGet('contacts?$select=fullname');
    expect(api.queryData).toHaveBeenCalledWith('contacts?$select=fullname');
  });
});
```

- [ ] **Step 2: Run the adapter tests**

```
npx vitest run src/__tests__/PptbContextAdapter.test.ts
```

Expected: all tests pass. Fix any failures before continuing.

- [ ] **Step 3: Replace MetadataService.test.ts**

```typescript
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
    });
  });

  it('passes correct property list to getAllEntitiesMetadata', async () => {
    const xrm = makeXrm('user-123', [], []);
    const svc = new MetadataService(xrm);
    await svc.listAccessibleTables();
    expect(xrm.getAllEntitiesMetadata).toHaveBeenCalledWith([
      'LogicalName', 'DisplayName', 'ObjectTypeCode',
      'IsIntersect', 'IsPrivate', 'Privileges',
    ]);
  });

  it('excludes entities without matching write privilege', async () => {
    const xrm = makeXrm('user-123', [ENTITY_ACCOUNT], []); // no privileges
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
    // This test asserts the abstraction is clean: no window globals polluted.
    // If this test passes without vi.stubGlobal('dataverseAPI', ...), the abstraction is correct.
    expect((window as any).dataverseAPI).toBeUndefined();
    const xrm = makeXrm('user-123', [ENTITY_ACCOUNT], [PRIV_WRITE_ACCOUNT]);
    const svc = new MetadataService(xrm);
    const result = await svc.listAccessibleTables();
    expect(result.status).toBe('ok');
  });
});
```

- [ ] **Step 4: Run all tests**

```
npx vitest run
```

Expected: all tests pass. Fix any failures before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/PptbContextAdapter.test.ts src/__tests__/MetadataService.test.ts
git commit -m "test: fix test contracts to match PPTB API format, remove global stubs from MetadataService tests"
```

---

## Self-Review Checklist

- [x] **Issue #1** (wrong `execute` format in adapter) — fixed in Task 1 (`operationName`/`operationType`)
- [x] **Issue #2** (wrong `execute` params in MetadataService) — fixed in Task 3 (`parameters: { UserId }`)
- [x] **Issue #3** (`getAllEntitiesMetadata` response unwrap) — fixed in Task 1 (adapter unwraps `result.value`), consumed correctly in Task 3
- [x] **Issue #4** (no connection readiness check) — fixed in Task 2 (`getActiveConnection()` + error state)
- [x] **Issue #5** (MetadataService bypasses IXrmContext) — fixed in Task 3 (uses `xrm.dataverseExecute`, `xrm.getAllEntitiesMetadata`)
- [x] **Issue #6** (eager constructor WhoAmI) — fixed in Task 1 (lazy init with null check)
- [x] **Issue #7** (no connection event subscription) — fixed in Task 2 (`connection:updated/created/deleted`)
- [x] **Issue #8** (`webApiGet` envelope) — fixed in Task 1 (unwraps `result.value`)
- [x] **Issue #9** (test asserts wrong execute format) — fixed in Task 4
- [x] **Issue #10** (test mock returns wrong shape) — fixed in Task 4 (MetadataService tests use injected xrm)
- [x] **Issue #11** (global stub smell) — fixed in Task 4 (no more `vi.stubGlobal('dataverseAPI')` in MetadataService tests)
- [x] **Issue #13** (brittle version regex) — fixed in Task 1 (`/v\d+\.\d+/` instead of `/v9\.\d+/`)
- [ ] **Issue #12** (`@pptb/types` reference) — out of scope for this plan (types package may not be installed; deferred)
- [ ] **Issue #14** (`connectionTarget` on IXrmContext) — deferred; no callers use dual-env yet
