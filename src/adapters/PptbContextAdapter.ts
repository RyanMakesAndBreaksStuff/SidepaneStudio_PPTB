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
}

export class PptbContextAdapter implements IXrmContext {
  readonly isAvailable = false;
  readonly sidePanesAvailable = false;

  private readonly _whoAmIPromise: Promise<string>;

  constructor() {
    this._whoAmIPromise = (window as any).dataverseAPI
      .execute({ RequestName: 'WhoAmI' })
      .then((r: any) => r.UserId as string);
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
    return this._whoAmIPromise;
  }

  async webApiGet<T = unknown>(odataPath: string): Promise<T> {
    const cleanPath = odataPath.replace(/^\/api\/data\/v9\.\d+\//, '');
    return (window as any).dataverseAPI.queryData(cleanPath) as Promise<T>;
  }
}
