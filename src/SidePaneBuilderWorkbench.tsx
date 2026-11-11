import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { PaneDefinitionConfig, DEFAULT_CONFIG, PageType, TargetConfig } from './types/PaneDefinitionConfig';
import { parseStoredConfig, parseStoredOrgKey } from './services/configGuards';
import { coerceConfig } from './services/triggerCapabilities';
import { notify } from './services/notify';
import { WorkbenchShell } from './components/WorkbenchShell';
import { StatusScreen } from './components/StatusScreen';
import { PptbContextAdapter } from './adapters/PptbContextAdapter';
import { subscribeToolboxEvents } from './adapters/toolboxEvents';
import { MetadataService } from './services/MetadataService';
import { MetadataFilterSettingsService, type MetadataFilterSettingsResult } from './services/MetadataFilterSettingsService';
import {
  DEFAULT_METADATA_FILTER_CONFIG,
  MetadataFilterConfig,
} from './types/MetadataFilterConfig';
import type { MetadataFilterDraft } from './components/config/MetadataFilterConfigEditor';

type ConnectionState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string; retryable?: boolean };

/** Settings failures are silent by default — the user must learn the write did not land. */
function reportSettingsFailure(action: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`SidePaneBuilderWorkbench: ${action} failed`, err);
  notify('Preferences not saved', `${action} failed: ${message}`, 'error');
}

/** Target fields that only exist in the org they were picked from; exhaustive so a new page type must decide. */
const ORG_SCOPED_TARGET_FIELDS: {
  readonly [P in PageType]: ReadonlyArray<Exclude<keyof Extract<TargetConfig, { pageType: P }>, 'pageType'>>;
} = {
  entityrecord: ['entityName', 'formId', 'tabName'],
  entitylist: ['entityName', 'viewId', 'viewType'],
  dashboard: ['dashboardId', 'dashboardName'],
  generative: ['pageId', 'data'],
  custom: [],
  webresource: [],
  search: [],
};

/** W20 — the org a config is saved for: the normalized URL host. Null when the URL is unusable: nothing is saved or flagged. */
function orgKeyOf(conn: ToolBoxAPI.Connection): string | null {
  try {
    return new URL(conn.url).host.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** PPTB Desktop sends connection:updated {id, tokenRefreshed: true} on every token refresh; nothing the tool reads changed. */
function isTokenRefresh(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as { tokenRefreshed?: unknown }).tokenRefreshed === true;
}

/** Table, form, view, dashboard, page, and record selections only exist in the org they were picked from. */
function clearOrgSelections(config: PaneDefinitionConfig): PaneDefinitionConfig {
  const { target, context: { source } } = config;
  const cleared = { ...target };
  // The field list is checked per page type above; the union of keys cannot be indexed on the union of variants.
  for (const field of ORG_SCOPED_TARGET_FIELDS[target.pageType] as readonly string[]) (cleared as Record<string, unknown>)[field] = '';
  return coerceConfig({
    ...config,
    target: cleared,
    host: { ...config.host, entityName: '', formId: '', viewId: '', viewType: '', attribute: '', lookupControls: [] },
    context: { ...config.context, source:
      source.kind === 'fixed' ? { kind: 'fixed', entityName: '', id: '' } :
      source.kind === 'lookup' ? { kind: 'lookup', attribute: '' } : source },
  });
}

/** W20 — the values clearOrgSelections clears, as one comparable string; a change to any of them is a re-pick. */
function orgSelectionsOf(config: PaneDefinitionConfig): string {
  const { target, host, context: { source } } = config;
  const targetValues = (ORG_SCOPED_TARGET_FIELDS[target.pageType] as readonly string[])
    .map(field => (target as Record<string, unknown>)[field]);
  return JSON.stringify([targetValues, host, source.kind === 'fixed' || source.kind === 'lookup' ? source : null]);
}

/** The wide layout's three panels need 308 + 300 + 420 px and two borders; below this the Output panel is clipped. */
const WIDE_LAYOUT_MIN_WIDTH = 1040;

export function SidePaneBuilderWorkbench(): React.ReactElement {
  const [config, setConfig] = useState<PaneDefinitionConfig>(DEFAULT_CONFIG);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const [layoutMode, setLayoutMode] = useState<'wide' | 'narrow'>(
    window.innerWidth >= WIDE_LAYOUT_MIN_WIDTH ? 'wide' : 'narrow'
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'loading' });
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [settingsRestoreError, setSettingsRestoreError] = useState<string | null>(null);
  const [metadataFilterConfig, setMetadataFilterConfig] = useState<MetadataFilterConfig>(
    DEFAULT_METADATA_FILTER_CONFIG
  );
  const [metadataFilterPersistenceAvailable, setMetadataFilterPersistenceAvailable] = useState(false);
  const [metadataFilterError, setMetadataFilterError] = useState<string | null>(null);
  const [metadataFilterLoadFailed, setMetadataFilterLoadFailed] = useState(false);
  // Unsaved filter edits live above every remount: Section collapse, panel collapse, connection change.
  const [metadataFilterDraft, setMetadataFilterDraft] = useState<MetadataFilterDraft | null>(null);
  // W20 — org of the active connection, and a restored config's org with the selections it was restored with.
  // Null once confirmed: "Use anyway", a re-pick of any org-scoped selection, a live org switch, or Reset.
  const [activeOrgKey, setActiveOrgKey] = useState<string | null>(null);
  const [restoredOrg, setRestoredOrg] = useState<{ orgKey: string; selections: string } | null>(null);
  // A selection re-picked here belongs to the active org, which confirms the restore; adjusted during render so it sticks.
  if (restoredOrg && restoredOrg.selections !== orgSelectionsOf(config)) setRestoredOrg(null);
  const savedOrgKey = restoredOrg?.orgKey ?? null;
  const orgMismatch = savedOrgKey !== null && activeOrgKey !== null && savedOrgKey !== activeOrgKey;
  const configDirtyRef = useRef(false);
  const pendingSaveRef = useRef<(() => void) | null>(null);
  const restoreAttemptRef = useRef(0);
  const refreshConnectionRef = useRef<(() => Promise<void>) | null>(null);

  const adapterRef = useRef<PptbContextAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = new PptbContextAdapter();

  const metaRef = useRef<MetadataService | null>(null);
  if (!metaRef.current) metaRef.current = new MetadataService(adapterRef.current);

  const metadataFilterSettingsRef = useRef<MetadataFilterSettingsService | null>(null);
  if (!metadataFilterSettingsRef.current) {
    metadataFilterSettingsRef.current = new MetadataFilterSettingsService(window.toolboxAPI?.settings);
  }

  // A load, save or reset outcome reaches the service, the shell's copy and the persistence flag together, and ends any error.
  const applyFilterResult = useCallback((result: MetadataFilterSettingsResult) => {
    metaRef.current?.setFilterConfig(result.config);
    setMetadataFilterConfig(result.config);
    setMetadataFilterPersistenceAvailable(result.persistenceAvailable);
    setMetadataFilterError(null);
    setMetadataFilterLoadFailed(false);
  }, []);

  // Hydrate metadata table filters independently from pane definition config; Retry runs the same load again.
  const filterLoadRef = useRef(0);
  const loadMetadataFilters = useCallback(() => {
    const attempt = ++filterLoadRef.current;
    const service = metadataFilterSettingsRef.current;
    if (!service) return;
    service.load().then(result => {
      if (attempt !== filterLoadRef.current) return;
      applyFilterResult(result);
    }).catch((err: unknown) => {
      if (attempt !== filterLoadRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load metadata filter settings.';
      setMetadataFilterError(message);
      setMetadataFilterLoadFailed(true);
      metaRef.current?.setFilterConfig(DEFAULT_METADATA_FILTER_CONFIG);
      setMetadataFilterConfig(DEFAULT_METADATA_FILTER_CONFIG);
      // r2 WR-005 — one failed read does not mean the settings API is missing; Save stays available.
      setMetadataFilterPersistenceAvailable(service.persistenceAvailable);
    });
  }, [applyFilterResult]);
  useEffect(() => {
    loadMetadataFilters();
    return () => { ++filterLoadRef.current; };
  }, [loadMetadataFilters]);

  // Subscribe before the initial check; only the latest check can enable the UI.
  useEffect(() => {
    const toolbox = window.toolboxAPI;
    if (!toolbox) {
      setConnectionState({ status: 'error', message: 'toolboxAPI unavailable — open inside PPTB.' });
      return;
    }

    let active = true;
    let checkGeneration = 0;
    // Last connected org (its org key, or the connection id when the URL is unusable);
    // kept through disconnects so A → none → B still counts as a switch.
    let connectedOrg: string | null = null;

    // Rechecks in place: the shell stays mounted, and only a switch resets the preview, caches and selections.
    const refreshConnection = async () => {
      const generation = ++checkGeneration;
      try {
        const conn = await toolbox.connections.getActiveConnection();
        if (!active || generation !== checkGeneration) return;
        if (conn) {
          const org = orgKeyOf(conn) ?? conn.id;
          if (connectedOrg !== null && connectedOrg !== org) {
            setPreviewEpoch(value => value + 1);
            metaRef.current?.invalidate();
            // r2 WR-001 — the previous org's pending edit is written under its own key, and the cleared copy is
            // not saved over it until the user edits here.
            pendingSaveRef.current?.();
            configDirtyRef.current = false;
            setConfig(clearOrgSelections);
            setRestoredOrg(null);
            notify(
              'Environment changed',
              'Table, form, view and page selections from the previous environment were cleared.',
              'warning',
            );
          }
          connectedOrg = org;
          setActiveOrgKey(orgKeyOf(conn));
        }
        setConnectionState(conn ? { status: 'ready' } : {
          status: 'error',
          message: 'No active Dataverse connection. Connect an environment in PPTB and retry.',
          retryable: true,
        });
      } catch (err: unknown) {
        if (!active || generation !== checkGeneration) return;
        const message = err instanceof Error ? err.message : 'Failed to check connection.';
        setConnectionState({ status: 'error', message, retryable: true });
      }
    };

    const handler = (_event: unknown, payload?: ToolBoxAPI.ToolBoxEventPayload) => {
      if (!active) return;
      try {
        switch (payload?.event) {
          case 'connection:created':
          case 'connection:updated':
          case 'connection:deleted':
            if (!isTokenRefresh(payload.data)) void refreshConnection();
            break;
          default:
            break;
        }
      } catch (error) {
        // A throwing handler can break delivery of every subsequent event.
        console.error('SidePaneBuilderWorkbench: failed to handle toolbox event', error);
      }
    };

    refreshConnectionRef.current = refreshConnection;
    const unsubscribe = subscribeToolboxEvents(toolbox.events, handler);
    void refreshConnection();
    return () => {
      active = false;
      ++checkGeneration;
      refreshConnectionRef.current = null;
      unsubscribe();
    };
  }, []);

  // Responsive layout via ResizeObserver
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setLayoutMode(window.innerWidth >= WIDE_LAYOUT_MIN_WIDTH ? 'wide' : 'narrow');
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const restoreConfig = useCallback(async () => {
    const attempt = ++restoreAttemptRef.current;
    const toolbox = window.toolboxAPI;
    if (!toolbox) { setSettingsHydrated(true); return; }
    setSettingsRestoreError(null);
    try {
      const raw = await toolbox.settings.get('lastConfig');
      if (attempt !== restoreAttemptRef.current) return;
      if (!configDirtyRef.current) {
        const stored = parseStoredConfig(raw);
        if (stored) {
          setConfig(stored);
          const orgKey = parseStoredOrgKey(raw);
          setRestoredOrg(orgKey ? { orgKey, selections: orgSelectionsOf(stored) } : null);
        } else if (raw != null && raw !== '') {
          // Something is stored but unreadable: offer Retry / Continue with defaults rather than overwrite it silently.
          console.warn('SidePaneBuilderWorkbench: unusable stored config', raw);
          setSettingsRestoreError('Your saved configuration could not be read. Retry, or continue with defaults.');
          return;
        }
      }
      setSettingsHydrated(true);
    } catch (err) {
      if (attempt !== restoreAttemptRef.current) return;
      console.warn('SidePaneBuilderWorkbench: could not read stored config', err);
      setSettingsRestoreError('Could not restore your saved configuration. Retry, or continue with defaults.');
    }
  }, []);

  // Restore last config from PPTB settings on mount
  useEffect(() => {
    void restoreConfig();
    return () => { ++restoreAttemptRef.current; };
  }, [restoreConfig]);

  // Persist config to PPTB settings, debounced 500ms. An unconfirmed restore keeps the org it was saved for;
  // an unknown active org saves no key, like a legacy payload.
  const persistOrgKey = activeOrgKey === null ? null : savedOrgKey ?? activeOrgKey;
  useEffect(() => {
    pendingSaveRef.current = null;
    const toolbox = window.toolboxAPI;
    if (!toolbox || !settingsHydrated || !configDirtyRef.current) return;
    const save = () => {
      if (pendingSaveRef.current !== save) return;
      pendingSaveRef.current = null;
      toolbox.settings.set('lastConfig', JSON.stringify(persistOrgKey ? { ...config, orgKey: persistOrgKey } : config))
        .catch((err: unknown) => reportSettingsFailure('Saving your configuration', err));
    };
    pendingSaveRef.current = save;
    const id = setTimeout(save, 500);
    return () => clearTimeout(id);
  }, [config, settingsHydrated, persistOrgKey]);

  // The host sends no event when a tool tab closes, so a hidden window, a page unload or an unmount is the last
  // chance to write the pending edit.
  useEffect(() => {
    const flush = () => pendingSaveRef.current?.();
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const handleChange = useCallback(
    (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => {
      setConfig(prev => {
        const next = coerceConfig(updater(prev));
        // r2 WR-003 — a handler that returns the configuration unchanged is not an edit: it must not block a
        // pending restore or schedule a save.
        if (next !== prev) configDirtyRef.current = true;
        return next;
      });
    },
    []
  );

  const handleReset = useCallback(async () => {
    ++restoreAttemptRef.current;
    setSettingsRestoreError(null);
    setSettingsHydrated(true);
    configDirtyRef.current = false;
    setConfig(DEFAULT_CONFIG);
    setRestoredOrg(null);
    setPreviewEpoch(value => value + 1);
    const toolbox = window.toolboxAPI;
    try {
      await toolbox?.settings?.set('lastConfig', null);
      notify('Configuration reset', 'Your saved configuration was cleared and the defaults were restored.', 'success');
    } catch (err) {
      reportSettingsFailure('Clearing your saved configuration', err);
    }
  }, []);

  // "Use anyway" adopts the restored selections for the active org and saves that choice.
  const handleConfirmOrgMismatch = useCallback(() => {
    configDirtyRef.current = true;
    setRestoredOrg(null);
  }, []);

  const handleRetryConnection = useCallback(() => {
    setConnectionState({ status: 'loading' });
    void refreshConnectionRef.current?.();
  }, []);

  const handleSaveMetadataFilterConfig = useCallback(async (nextConfig: MetadataFilterConfig) => {
    try {
      const result = await metadataFilterSettingsRef.current?.save(nextConfig);
      if (!result) return;
      // Only a write that succeeded outdates a load still in flight; after a failed write that load still applies.
      ++filterLoadRef.current;
      applyFilterResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save metadata filter settings.';
      setMetadataFilterError(message);
      setMetadataFilterLoadFailed(false);
    }
  }, [applyFilterResult]);

  const handleResetMetadataFilterConfig = useCallback(async () => {
    try {
      const result = await metadataFilterSettingsRef.current?.reset();
      if (!result) return;
      // Only a write that succeeded outdates a load still in flight; after a failed write that load still applies.
      ++filterLoadRef.current;
      applyFilterResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset metadata filter settings.';
      setMetadataFilterError(message);
      setMetadataFilterLoadFailed(false);
    }
  }, [applyFilterResult]);

  if (connectionState.status === 'loading') {
    return <StatusScreen role="status" message="Connecting to Dataverse…" />;
  }

  if (connectionState.status === 'error') {
    return (
      <StatusScreen role="alert" icon="⚠" title="Connection unavailable" message={connectionState.message}
        action={connectionState.retryable ? { label: 'Retry', onClick: handleRetryConnection } : undefined} />
    );
  }

  if (settingsRestoreError) {
    return (
      <StatusScreen
        role="alert"
        message={settingsRestoreError}
        action={{ label: 'Retry restore', onClick: () => { void restoreConfig(); } }}
        secondaryAction={{
          label: 'Continue with defaults',
          onClick: () => {
            configDirtyRef.current = true;
            setSettingsRestoreError(null);
            setSettingsHydrated(true);
          },
        }}
      />
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
      metadataFilterConfig={metadataFilterConfig}
      defaultMetadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
      metadataFilterPersistenceAvailable={metadataFilterPersistenceAvailable}
      metadataFilterError={metadataFilterError}
      onSaveMetadataFilterConfig={handleSaveMetadataFilterConfig}
      onResetMetadataFilterConfig={handleResetMetadataFilterConfig}
      onRetryMetadataFilterLoad={metadataFilterLoadFailed ? loadMetadataFilters : undefined}
      metadataFilterDraft={metadataFilterDraft}
      onMetadataFilterDraftChange={setMetadataFilterDraft}
      previewEpoch={previewEpoch}
      orgMismatch={orgMismatch}
      onConfirmOrgMismatch={handleConfirmOrgMismatch}
    />
  );
}
