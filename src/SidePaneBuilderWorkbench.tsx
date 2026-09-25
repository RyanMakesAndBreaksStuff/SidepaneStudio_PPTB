import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { PaneDefinitionConfig, DEFAULT_CONFIG } from './types/PaneDefinitionConfig';
import { parseStoredConfig } from './services/configGuards';
import { WorkbenchShell } from './components/WorkbenchShell';
import { PptbContextAdapter } from './adapters/PptbContextAdapter';
import { MetadataService } from './services/MetadataService';
import { MetadataFilterSettingsService } from './services/MetadataFilterSettingsService';
import {
  DEFAULT_METADATA_FILTER_CONFIG,
  MetadataFilterConfig,
} from './types/MetadataFilterConfig';

type ConnectionState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

/** Settings failures are silent by default — the user must learn the write did not land. */
function reportSettingsFailure(action: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`SidePaneBuilderWorkbench: ${action} failed`, err);
  Promise.resolve(
    window.toolboxAPI?.utils?.showNotification({
      title: 'Preferences not saved',
      body: `${action} failed: ${message}`,
      type: 'error',
    })
  ).catch(() => { /* notification is best-effort; never mask the original failure */ });
}

/** Table, form, view, dashboard, and record selections only exist in the org they were picked from. */
function clearOrgSelections(config: PaneDefinitionConfig): PaneDefinitionConfig {
  const { target } = config;
  return {
    ...config,
    target:
      target.pageType === 'entityrecord' ? { ...target, entityName: '', formId: '', tabName: '' } :
      target.pageType === 'entitylist' ? { ...target, entityName: '', viewId: '', viewType: '' } :
      target.pageType === 'dashboard' ? { ...target, dashboardId: '', dashboardName: '' } :
      target,
    context: { ...config.context, entityName: '', staticRecordId: '', lookupAttribute: '' },
  };
}

export function SidePaneBuilderWorkbench(): React.ReactElement {
  const [config, setConfig] = useState<PaneDefinitionConfig>(DEFAULT_CONFIG);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const [layoutMode, setLayoutMode] = useState<'wide' | 'narrow'>(
    window.innerWidth >= 900 ? 'wide' : 'narrow'
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'loading' });
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [settingsRestoreError, setSettingsRestoreError] = useState<string | null>(null);
  const [metadataFilterConfig, setMetadataFilterConfig] = useState<MetadataFilterConfig>(
    DEFAULT_METADATA_FILTER_CONFIG
  );
  const [metadataFilterPersistenceAvailable, setMetadataFilterPersistenceAvailable] = useState(false);
  const [metadataFilterError, setMetadataFilterError] = useState<string | null>(null);
  const configDirtyRef = useRef(false);
  const restoreAttemptRef = useRef(0);

  const adapterRef = useRef<PptbContextAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = new PptbContextAdapter();

  const metaRef = useRef<MetadataService | null>(null);
  if (!metaRef.current) metaRef.current = new MetadataService(adapterRef.current);

  const metadataFilterSettingsRef = useRef<MetadataFilterSettingsService | null>(null);
  if (!metadataFilterSettingsRef.current) {
    metadataFilterSettingsRef.current = new MetadataFilterSettingsService(window.toolboxAPI?.settings);
  }

  // Hydrate metadata table filters independently from pane definition config.
  useEffect(() => {
    let active = true;
    metadataFilterSettingsRef.current?.load().then(result => {
      if (!active) return;
      metaRef.current?.setFilterConfig(result.config);
      setMetadataFilterConfig(result.config);
      setMetadataFilterPersistenceAvailable(result.persistenceAvailable);
      setMetadataFilterError(null);
    }).catch((err: unknown) => {
      if (!active) return;
      const message = err instanceof Error ? err.message : 'Failed to load metadata filter settings.';
      setMetadataFilterError(message);
      metaRef.current?.setFilterConfig(DEFAULT_METADATA_FILTER_CONFIG);
      setMetadataFilterConfig(DEFAULT_METADATA_FILTER_CONFIG);
      setMetadataFilterPersistenceAvailable(false);
    });
    return () => { active = false; };
  }, []);

  // Subscribe before the initial check; only the latest check can enable the UI.
  useEffect(() => {
    const toolbox = window.toolboxAPI;
    if (!toolbox) {
      setConnectionState({ status: 'error', message: 'toolboxAPI unavailable — open inside PPTB.' });
      return;
    }

    let active = true;
    let checkGeneration = 0;
    // Last connected org; kept through disconnects so A → none → B still counts as a switch.
    let connectionId: string | null = null;

    const refreshConnection = async () => {
      const generation = ++checkGeneration;
      setConnectionState({ status: 'loading' });
      try {
        const conn = await toolbox.connections.getActiveConnection();
        if (!active || generation !== checkGeneration) return;
        if (conn) {
          if (connectionId !== null && connectionId !== conn.id) {
            configDirtyRef.current = true;
            setConfig(clearOrgSelections);
          }
          connectionId = conn.id;
        }
        setConnectionState(conn ? { status: 'ready' } : {
          status: 'error',
          message: 'No active Dataverse connection. Connect an environment in PPTB and retry.',
        });
      } catch (err: unknown) {
        if (!active || generation !== checkGeneration) return;
        const message = err instanceof Error ? err.message : 'Failed to check connection.';
        setConnectionState({ status: 'error', message });
      }
    };

    const handler = (_event: unknown, payload?: ToolBoxAPI.ToolBoxEventPayload) => {
      if (!active) return;
      try {
        switch (payload?.event) {
          case 'connection:created':
          case 'connection:updated':
          case 'connection:deleted':
            setPreviewEpoch(value => value + 1);
            adapterRef.current?.resetUserId();
            metaRef.current?.invalidate();
            void refreshConnection();
            break;
          default:
            break;
        }
      } catch (error) {
        // A throwing handler can break delivery of every subsequent event.
        console.error('SidePaneBuilderWorkbench: failed to handle toolbox event', error);
      }
    };

    toolbox.events.on(handler);
    void refreshConnection();
    return () => {
      active = false;
      ++checkGeneration;
      toolbox.events.off(handler);
    };
  }, []);

  // Responsive layout via ResizeObserver
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setLayoutMode(window.innerWidth >= 900 ? 'wide' : 'narrow');
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
        if (stored) setConfig(stored);
        else if (raw) console.warn('SidePaneBuilderWorkbench: unusable stored config, using defaults');
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

  // Persist config to PPTB settings, debounced 500ms
  useEffect(() => {
    const toolbox = window.toolboxAPI;
    if (!toolbox || !settingsHydrated || !configDirtyRef.current) return;
    const id = setTimeout(() => {
      toolbox.settings.set('lastConfig', JSON.stringify(config))
        .catch((err: unknown) => reportSettingsFailure('Saving your configuration', err));
    }, 500);
    return () => clearTimeout(id);
  }, [config, settingsHydrated]);

  const handleChange = useCallback(
    (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => {
      configDirtyRef.current = true;
      setConfig(prev => updater(prev));
    },
    []
  );

  const handleReset = useCallback(async () => {
    ++restoreAttemptRef.current;
    setSettingsRestoreError(null);
    setSettingsHydrated(true);
    configDirtyRef.current = false;
    setConfig(DEFAULT_CONFIG);
    setPreviewEpoch(value => value + 1);
    const toolbox = window.toolboxAPI;
    try {
      await toolbox?.settings?.set('lastConfig', null);
      window.toolboxAPI?.utils?.showNotification({
        title: 'Configuration reset',
        body: '',
        type: 'success',
      });
    } catch (err) {
      reportSettingsFailure('Clearing your saved configuration', err);
    }
  }, []);

  const handleSaveMetadataFilterConfig = useCallback(async (nextConfig: MetadataFilterConfig) => {
    try {
      const result = await metadataFilterSettingsRef.current?.save(nextConfig);
      if (!result) return;
      metaRef.current?.setFilterConfig(result.config);
      setMetadataFilterConfig(result.config);
      setMetadataFilterPersistenceAvailable(result.persistenceAvailable);
      setMetadataFilterError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save metadata filter settings.';
      setMetadataFilterError(message);
    }
  }, []);

  const handleResetMetadataFilterConfig = useCallback(async () => {
    try {
      const result = await metadataFilterSettingsRef.current?.reset();
      if (!result) return;
      metaRef.current?.setFilterConfig(result.config);
      setMetadataFilterConfig(result.config);
      setMetadataFilterPersistenceAvailable(result.persistenceAvailable);
      setMetadataFilterError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset metadata filter settings.';
      setMetadataFilterError(message);
    }
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

  if (settingsRestoreError) {
    return (
      <div role="alert" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 12,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: '#1A1A1A', color: '#E8E8E8',
      }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>{settingsRestoreError}</div>
        <button type="button" onClick={() => { void restoreConfig(); }}>Retry restore</button>
        <button type="button" onClick={() => {
          configDirtyRef.current = true;
          setSettingsRestoreError(null);
          setSettingsHydrated(true);
        }}>Continue with defaults</button>
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
      metadataFilterConfig={metadataFilterConfig}
      defaultMetadataFilterConfig={DEFAULT_METADATA_FILTER_CONFIG}
      metadataFilterPersistenceAvailable={metadataFilterPersistenceAvailable}
      metadataFilterError={metadataFilterError}
      onSaveMetadataFilterConfig={handleSaveMetadataFilterConfig}
      onResetMetadataFilterConfig={handleResetMetadataFilterConfig}
      previewEpoch={previewEpoch}
    />
  );
}
