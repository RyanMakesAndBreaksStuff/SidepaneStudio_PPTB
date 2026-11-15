import { useCallback, useEffect, useState } from 'react';
import { MetadataService, TableInfo } from '../services/MetadataService';
import { describeDataverseError } from '../services/dataverseErrorText';

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

export function useAccessibleTables(metadataService: AccessibleTablesService): AccessibleTablesState {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: 'loading' });

    metadataService.listAccessibleTables().then(result => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setLoadState({ status: 'loaded', tables: result.tables });
      } else {
        setLoadState({ status: 'error', reason: result.reason });
      }
    }).catch(err => {
      if (cancelled) return;
      setLoadState({ status: 'error', reason: describeDataverseError(err, 'Unable to load table list.') });
    });

    return () => { cancelled = true; };
  }, [metadataService, reloadKey]);

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
