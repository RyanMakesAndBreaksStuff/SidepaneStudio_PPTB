// src/adapters/PptbContextAdapter.ts
import { escapeODataStringLiteral } from '../services/odataGuards';

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

/**
 * Contract actually consumed through the `IXrmContext` type by production code:
 * `checkWebResourceExists` (src/components/OutputPanel.tsx), and `webApiGet` /
 * `webApiGetEntity` (src/services/FormXmlService.ts, src/services/MetadataService.ts).
 * Verified by grepping all of `src` for each prior member name outside
 * adapters/tests (PR-002, 2026-09-03) — none of the other original 12 members
 * had a production caller reached through this interface.
 */
export interface FetchXmlResult {
  value: Record<string, unknown>[];
}

export interface IXrmContext {
  checkWebResourceExists(name: string): Promise<boolean>;
  webApiGet<T = unknown>(path: string): Promise<T>;
  webApiGetEntity<T = unknown>(path: string): Promise<T>;
  fetchXml(xml: string): Promise<FetchXmlResult>;
}

/**
 * Members that were previously part of `IXrmContext` but have no production
 * caller reaching them through that interface type. They remain implemented
 * on the concrete `PptbContextAdapter` (some are used internally — e.g.
 * `dataverseExecute` backs `getCurrentUserId`'s WhoAmI caching — and all are
 * covered directly against the concrete class in PptbContextAdapter.test.ts).
 * Kept here as a documented extension point, rather than deleted outright, so
 * a future `IXrmContext` implementation isn't left guessing why this surface
 * exists on the adapter but not the interface.
 */
export interface IXrmHostExtensions {
  isAvailable: boolean;
  sidePanesAvailable: boolean;
  createPane(options: PaneCreateOptions): Promise<AppSidePane>;
  getPane(paneId: string): AppSidePane | undefined;
  getHostKind(): 'SingleSession' | 'MultiSession' | 'Unknown';
  readEnvVar(name: string): Promise<string | null>;
  getCurrentAppId(): string | null;
  getCurrentUserId(): Promise<string>;
  dataverseExecute<T = unknown>(request: DataverseExecuteRequest): Promise<T>;
  getAllEntitiesMetadata(properties: string[]): Promise<any[]>;
}

/** Error thrown for Dataverse failures; carries HTTP details when the host supplies them. */
export class DataverseError extends Error {
  status?: number;
  statusText?: string;

  constructor(message: string, status?: number, statusText?: string) {
    super(message);
    this.name = 'DataverseError';
    this.status = status;
    this.statusText = statusText;
  }
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof reason === 'object' && reason !== null) {
    const { message, status, statusText } = reason as { message?: unknown; status?: unknown; statusText?: unknown };
    let text: string;
    if (typeof message === 'string' && message) {
      text = message;
    } else {
      try {
        text = JSON.stringify(reason) ?? String(reason);
      } catch {
        text = String(reason);
      }
    }
    return new DataverseError(
      text,
      typeof status === 'number' ? status : undefined,
      typeof statusText === 'string' ? statusText : undefined
    );
  }
  return new DataverseError(String(reason));
}

export class PptbContextAdapter implements IXrmContext, IXrmHostExtensions {
  readonly isAvailable = false;
  readonly sidePanesAvailable = false;

  private _whoAmIPromise: Promise<string> | null = null;

  /** Wraps a dataverseAPI call so non-Error rejections become Error instances. */
  private async callApi<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (reason) {
      throw toError(reason);
    }
  }

  async createPane(_options: PaneCreateOptions): Promise<never> {
    throw new Error('Side pane creation is not available in the PPTB context.');
  }

  getPane(_paneId: string): undefined {
    return undefined;
  }

  getHostKind(): 'Unknown' {
    return 'Unknown';
  }

  async checkWebResourceExists(name: string): Promise<boolean> {
    const result = await this.callApi(() => window.dataverseAPI.queryData(
      `webresourceset?$select=webresourceid&$filter=name eq '${escapeODataStringLiteral(name)}'&$top=1`
    ));
    return (result.value ?? []).length > 0;
  }

  async readEnvVar(name: string): Promise<null> {
    console.warn(`PptbContextAdapter: readEnvVar("${name}") is not implemented in this host`);
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
      }).then(r => r.UserId).catch((error: unknown) => {
        this._whoAmIPromise = null;
        throw error;
      });
    }
    return this._whoAmIPromise;
  }

  resetUserId(): void {
    this._whoAmIPromise = null;
  }

  async webApiGet<T = unknown>(odataPath: string): Promise<T> {
    const cleanPath = odataPath.replace(/^\/api\/data\/v\d+\.\d+\//, '');
    const result = await this.callApi(() => window.dataverseAPI.queryData(cleanPath));
    if (!Array.isArray(result?.value)) {
      throw new Error(`Unexpected response for ${cleanPath}: missing value array`);
    }
    return result.value as unknown as T;
  }

  /**
   * Single-entity GET. dataverseAPI.queryData is typed as a collection response
   * ({ value: [...] }) but returns the entity itself for a keyed path, so the cast
   * is unavoidable — it is confined here rather than leaking into services.
   */
  async webApiGetEntity<T = unknown>(odataPath: string): Promise<T> {
    const cleanPath = odataPath.replace(/^\/api\/data\/v\d+\.\d+\//, '');
    const result = await this.callApi(() => window.dataverseAPI.queryData(cleanPath));
    const value = (result as { value?: unknown } | null | undefined)?.value;
    if (Array.isArray(value) && value.length === 1) return value[0] as T;
    return result as unknown as T;
  }

  async dataverseExecute<T = unknown>(request: DataverseExecuteRequest): Promise<T> {
    if (!request.operationName) throw new Error('dataverseExecute: operationName is required');
    if (!request.operationType) throw new Error('dataverseExecute: operationType is required');
    const payload: DataverseAPI.ExecuteRequest = {
      operationName: request.operationName,
      operationType: request.operationType,
    };
    if (request.entityName !== undefined) payload.entityName = request.entityName;
    if (request.entityId !== undefined) payload.entityId = request.entityId;
    if (request.parameters !== undefined) payload.parameters = request.parameters;
    return this.callApi(() => window.dataverseAPI.execute(payload)) as Promise<T>;
  }

  async fetchXml(xml: string): Promise<FetchXmlResult> {
    return this.callApi(() => window.dataverseAPI.fetchXmlQuery(xml));
  }

  async getAllEntitiesMetadata(properties: string[]): Promise<any[]> {
    const result = await this.callApi(() => window.dataverseAPI.getAllEntitiesMetadata(properties));
    return result.value;
  }
}
