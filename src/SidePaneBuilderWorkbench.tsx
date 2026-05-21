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
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const configDirtyRef = useRef(false);

  const adapterRef = useRef<PptbContextAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = new PptbContextAdapter();

  const metaRef = useRef<MetadataService | null>(null);
  if (!metaRef.current) metaRef.current = new MetadataService(adapterRef.current);

  // Verify active connection before allowing API calls
  useEffect(() => {
    const toolbox = window.toolboxAPI;
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
    const toolbox = window.toolboxAPI;
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

    toolbox.events.on(handler);
    return () => { toolbox.events.off(handler); };
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
    const toolbox = window.toolboxAPI;
    if (!toolbox) {
      setSettingsHydrated(true);
      return;
    }
    let active = true;
    toolbox.settings.get('lastConfig').then((raw: string | null) => {
      if (!active || !raw || configDirtyRef.current) return;
      try {
        setConfig(JSON.parse(raw) as PaneDefinitionConfig);
      } catch {
        // corrupted stored config — ignore
      }
    }).finally(() => {
      if (active) setSettingsHydrated(true);
    });
    return () => { active = false; };
  }, []);

  // Persist config to PPTB settings, debounced 500ms
  useEffect(() => {
    const toolbox = window.toolboxAPI;
    if (!toolbox || !settingsHydrated || !configDirtyRef.current) return;
    const id = setTimeout(() => {
      toolbox.settings.set('lastConfig', JSON.stringify(config));
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

  const handleReset = useCallback(() => {
    configDirtyRef.current = false;
    setConfig(DEFAULT_CONFIG);
    const toolbox = window.toolboxAPI;
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
