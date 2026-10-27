// src/adapters/PptbContextAdapter.ts
import { escapeODataStringLiteral } from '../services/odataGuards';

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

export class PptbContextAdapter implements IXrmContext {
  /** Wraps a dataverseAPI call so non-Error rejections become Error instances. */
  private async callApi<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (reason) {
      throw toError(reason);
    }
  }

  async checkWebResourceExists(name: string): Promise<boolean> {
    const result = await this.callApi(() => window.dataverseAPI.queryData(
      `webresourceset?$select=webresourceid&$filter=name eq '${escapeODataStringLiteral(name)}'&$top=1`
    ));
    return (result.value ?? []).length > 0;
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

  async fetchXml(xml: string): Promise<FetchXmlResult> {
    return this.callApi(() => window.dataverseAPI.fetchXmlQuery(xml));
  }
}
