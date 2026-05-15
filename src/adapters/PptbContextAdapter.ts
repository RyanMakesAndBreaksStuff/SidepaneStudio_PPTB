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
  webApiGet<T = unknown>(path: string, connectionTarget?: 'primary' | 'secondary'): Promise<T>;
  dataverseExecute<T = unknown>(request: DataverseExecuteRequest, connectionTarget?: 'primary' | 'secondary'): Promise<T>;
  getAllEntitiesMetadata(properties: string[], connectionTarget?: 'primary' | 'secondary'): Promise<any[]>;
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

  async webApiGet<T = unknown>(odataPath: string, connectionTarget?: 'primary' | 'secondary'): Promise<T> {
    const cleanPath = odataPath.replace(/^\/api\/data\/v\d+\.\d+\//, '');
    const result = await window.dataverseAPI.queryData(cleanPath, connectionTarget);
    return result.value as unknown as T;
  }

  async dataverseExecute<T = unknown>(request: DataverseExecuteRequest, connectionTarget?: 'primary' | 'secondary'): Promise<T> {
    const payload: DataverseAPI.ExecuteRequest = {
      operationName: request.operationName,
      operationType: request.operationType,
    };
    if (request.entityName !== undefined) payload.entityName = request.entityName;
    if (request.entityId !== undefined) payload.entityId = request.entityId;
    if (request.parameters !== undefined) payload.parameters = request.parameters;
    return window.dataverseAPI.execute(payload, connectionTarget) as Promise<T>;
  }

  async getAllEntitiesMetadata(properties: string[], connectionTarget?: 'primary' | 'secondary'): Promise<any[]> {
    const result = await window.dataverseAPI.getAllEntitiesMetadata(properties, connectionTarget);
    return result.value;
  }
}
