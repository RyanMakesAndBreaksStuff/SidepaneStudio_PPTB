import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { PaneDefinitionConfig, DEFAULT_CONFIG } from './types/PaneDefinitionConfig';
import { WorkbenchShell } from './components/WorkbenchShell';
import { PptbContextAdapter } from './adapters/PptbContextAdapter';
import { MetadataService } from './services/MetadataService';

export function SidePaneBuilderWorkbench(): React.ReactElement {
  const [config, setConfig] = useState<PaneDefinitionConfig>(DEFAULT_CONFIG);
  const [layoutMode, setLayoutMode] = useState<'wide' | 'narrow'>(
    window.innerWidth >= 900 ? 'wide' : 'narrow'
  );

  const adapterRef = useRef<PptbContextAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = new PptbContextAdapter();

  const metaRef = useRef<MetadataService | null>(null);
  if (!metaRef.current) metaRef.current = new MetadataService(adapterRef.current);

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
    const toolbox = (window as any).toolboxAPI;
    if (!toolbox) return;
    toolbox.settings.get('lastConfig').then((raw: string | null) => {
      if (!raw) return;
      try {
        setConfig(JSON.parse(raw) as PaneDefinitionConfig);
      } catch {
        // corrupted stored config — ignore
      }
    });
  }, []);

  // Persist config to PPTB settings, debounced 500ms
  useEffect(() => {
    const toolbox = (window as any).toolboxAPI;
    if (!toolbox) return;
    const id = setTimeout(() => {
      toolbox.settings.set('lastConfig', JSON.stringify(config));
    }, 500);
    return () => clearTimeout(id);
  }, [config]);

  const handleChange = useCallback(
    (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => {
      setConfig(prev => updater(prev));
    },
    []
  );

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    const toolbox = (window as any).toolboxAPI;
    toolbox?.settings?.set('lastConfig', null);
  }, []);

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
