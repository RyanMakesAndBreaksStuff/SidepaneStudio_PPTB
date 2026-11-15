// src/adapters/PptbContextAdapter.ts
import { escapeODataStringLiteral } from '../services/odataGuards';

export interface FetchXmlResult {
  value: Record<string, unknown>[];
}

/**
 * The Dataverse calls the tool makes, over `window.dataverseAPI`. Production readers:
 * `checkWebResourceExists` (OutputPanel), `webApiGet` (MetadataService, FormXmlService),
 * `webApiGetEntity` (FormXmlService) and `fetchXml` (GridPreview, PreviewPanel).
 */
export interface IXrmContext {
  /** Name of the first web resource whose name ends with `suffix`, or null when none exists. */
  checkWebResourceExists(suffix: string): Promise<string | null>;
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

/** Electron prefixes every rejected IPC call: `Error invoking remote method '<channel>': Error: <message>`. */
const HOST_ERROR_PREFIX = /^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/;
const HTTP_STATUS = /\bHTTP (\d{3})\b/;
const DATAVERSE_CODE = /\b0x[0-9a-f]{8}\b/i;
/** When the response body is a Dataverse JSON error the host sends `<code>: <message>` and drops the HTTP status. */
const DATAVERSE_CODE_STATUS: Record<string, number> = {
  '0x80040217': 404, // ObjectDoesNotExist
  '0x80072322': 429, // service protection: number of requests
  '0x80072321': 429, // service protection: execution time
  '0x80072326': 429, // service protection: concurrent requests
};

function statusOf(message: string): number | undefined {
  const http = HTTP_STATUS.exec(message);
  if (http) return Number(http[1]);
  const code = DATAVERSE_CODE.exec(message)?.[0].toLowerCase();
  return code ? DATAVERSE_CODE_STATUS[code] : undefined;
}

/** The host rejects with a plain Error and never sets `.status`; recover it from the message. */
function fromHostError(error: Error): Error {
  const message = error.message.replace(HOST_ERROR_PREFIX, '');
  const status = statusOf(message);
  if (message === error.message && status === undefined) return error;
  return new DataverseError(message, status);
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) return fromHostError(reason);
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

  async checkWebResourceExists(suffix: string): Promise<string | null> {
    const result = await this.callApi(() => window.dataverseAPI.queryData(
      `webresourceset?$select=name&$filter=endswith(name,'${escapeODataStringLiteral(suffix)}')&$top=1`
    ));
    const name = result.value?.[0]?.name;
    return typeof name === 'string' ? name : null;
  }

  async webApiGet<T = unknown>(odataPath: string): Promise<T> {
    const result = await this.callApi(() => window.dataverseAPI.queryData(odataPath));
    if (!Array.isArray(result?.value)) {
      throw new Error(`Unexpected response for ${odataPath}: missing value array`);
    }
    return result.value as unknown as T;
  }

  /**
   * Single-entity GET. dataverseAPI.queryData is typed as a collection response
   * ({ value: [...] }) but returns the entity itself for a keyed path, so the cast
   * is unavoidable — it is confined here rather than leaking into services.
   */
  async webApiGetEntity<T = unknown>(odataPath: string): Promise<T> {
    const result = await this.callApi(() => window.dataverseAPI.queryData(odataPath));
    const value = (result as { value?: unknown } | null | undefined)?.value;
    if (Array.isArray(value) && value.length === 1) return value[0] as T;
    return result as unknown as T;
  }

  async fetchXml(xml: string): Promise<FetchXmlResult> {
    return this.callApi(() => window.dataverseAPI.fetchXmlQuery(xml));
  }
}
