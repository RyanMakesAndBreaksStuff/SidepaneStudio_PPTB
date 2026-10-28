import { useCallback, useEffect, useState } from 'react';
import { MetadataService, TableInfo } from '../services/MetadataService';

export type AccessibleTablesService = Pick<
  MetadataService,
  'listAccessibleTables' | 'invalidate' | 'subscribeTables'
>;

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; tables: TableInfo[] }
  | { status: 'error'; reason: string };

const NO_TABLES: TableInfo[] = [];

export interface AccessibleTablesState {
  tables: TableInfo[];
  loading: boolean;
  error: string | undefined;
  retry: () => void;
}

export function useAccessibleTables(
  metadataService: AccessibleTablesService,
  onAccessibleTablesChange?: (tables: Set<string> | undefined) => void,
): AccessibleTablesState {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: 'loading' });
    onAccessibleTablesChange?.(undefined);

    metadataService.listAccessibleTables().then(result => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setLoadState({ status: 'loaded', tables: result.tables });
        onAccessibleTablesChange?.(new Set(result.tables.map(table => table.logicalName)));
      } else {
        setLoadState({ status: 'error', reason: result.reason });
        onAccessibleTablesChange?.(undefined);
      }
    }).catch(err => {
      if (cancelled) return;
      setLoadState({
        status: 'error',
        reason: err instanceof Error ? err.message : 'Unable to load table list.',
      });
      onAccessibleTablesChange?.(undefined);
    });

    return () => { cancelled = true; };
  }, [metadataService, onAccessibleTablesChange, reloadKey]);

  useEffect(
    () => metadataService.subscribeTables(() => setReloadKey(key => key + 1)),
    [metadataService]
  );

  const retry = useCallback(() => {
    metadataService.invalidate();
    setReloadKey(key => key + 1);
  }, [metadataService]);

  return {
    tables: loadState.status === 'loaded' ? loadState.tables : NO_TABLES,
    loading: loadState.status === 'loading',
    error: loadState.status === 'error' ? loadState.reason : undefined,
    retry,
  };
}
