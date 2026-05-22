import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { IXrmContext } from '../adapters/PptbContextAdapter';
import { MetadataService } from '../services/MetadataService';
import { validate } from '../services/ValidationService';
import { CommandBar } from './CommandBar';
import { ConfigurePanel } from './ConfigurePanel';
import { PreviewPanel } from './PreviewPanel';
import { OutputPanel } from './OutputPanel';

export interface WorkbenchShellProps {
  config: PaneDefinitionConfig;
  onChange: (updater: (prev: PaneDefinitionConfig) => PaneDefinitionConfig) => void;
  onReset: () => void;
  xrm: IXrmContext;
  layoutMode: 'wide' | 'narrow';
  metadataService: MetadataService;
}

type NarrowTab = 'configure' | 'preview' | 'output';

const NARROW_TABS: { id: NarrowTab; label: string }[] = [
  { id: 'configure', label: 'Configure' },
  { id: 'preview',   label: 'Preview' },
  { id: 'output',    label: 'Output' },
];

export function WorkbenchShell({
  config,
  onChange,
  onReset,
  xrm,
  layoutMode,
  metadataService,
}: WorkbenchShellProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [narrowTab, setNarrowTab] = useState<NarrowTab>('configure');
  const [accessibleTables, setAccessibleTables] = useState<Set<string> | undefined>(undefined);

  const validation = useMemo(() => validate(config, accessibleTables), [config, accessibleTables]);

  const configurePanelProps = {
    config,
    onChange,
    validation,
    metadataService,
    onAccessibleTablesChange: setAccessibleTables,
  };
  const previewPanelProps = { config, validation, metadataService };
  const outputPanelProps = { config, xrm, validation };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.pageBg }}>
      <CommandBar onReset={onReset} />

      {layoutMode === 'wide' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <aside style={{ width: 308, minWidth: 268, borderRight: `1px solid ${T.stroke1}`, overflow: 'auto', flexShrink: 0 }}>
            <ConfigurePanel {...configurePanelProps} />
          </aside>
          <section style={{ flex: 1, borderRight: `1px solid ${T.stroke1}`, minWidth: 300, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PreviewPanel {...previewPanelProps} />
          </section>
          <section style={{ width: 420, minWidth: 360, overflow: 'auto', flexShrink: 0 }}>
            <OutputPanel {...outputPanelProps} />
          </section>
        </div>
      )}

      {layoutMode === 'narrow' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            role="tablist"
            style={{
              display: 'flex',
              borderBottom: `1px solid ${T.stroke1}`,
              background: T.surface2,
              flexShrink: 0,
            }}
          >
            {NARROW_TABS.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={narrowTab === tab.id}
                onClick={() => setNarrowTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  borderBottom: narrowTab === tab.id ? `2px solid ${T.accentTeal}` : '2px solid transparent',
                  background: 'transparent',
                  color: narrowTab === tab.id ? T.accentTeal : T.fg2,
                  fontFamily: T.font,
                  fontSize: 13,
                  fontWeight: narrowTab === tab.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {narrowTab === 'configure' && <ConfigurePanel {...configurePanelProps} />}
            {narrowTab === 'preview'   && <PreviewPanel {...previewPanelProps} />}
            {narrowTab === 'output'    && <OutputPanel {...outputPanelProps} />}
          </div>
        </div>
      )}
    </div>
  );
}
