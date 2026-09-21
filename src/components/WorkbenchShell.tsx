import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { MetadataFilterConfig } from '../types/MetadataFilterConfig';
import { IXrmContext } from '../adapters/PptbContextAdapter';
import { MetadataService } from '../services/MetadataService';
import { FormXmlService } from '../services/FormXmlService';
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
  metadataFilterConfig: MetadataFilterConfig;
  defaultMetadataFilterConfig: MetadataFilterConfig;
  metadataFilterPersistenceAvailable: boolean;
  metadataFilterError?: string | null;
  onSaveMetadataFilterConfig: (config: MetadataFilterConfig) => Promise<void> | void;
  onResetMetadataFilterConfig: () => Promise<void> | void;
}

type NarrowTab = 'configure' | 'preview' | 'output';

const CONFIG_PANEL_WIDTH = 308;
const CONFIG_PANEL_MIN_WIDTH = 268;
const CODE_PANEL_WIDTH = 420;
const CODE_PANEL_MIN_WIDTH = 360;
const COLLAPSED_RAIL_WIDTH = 44;

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
  metadataFilterConfig,
  defaultMetadataFilterConfig,
  metadataFilterPersistenceAvailable,
  metadataFilterError,
  onSaveMetadataFilterConfig,
  onResetMetadataFilterConfig,
}: WorkbenchShellProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [narrowTab, setNarrowTab] = useState<NarrowTab>('configure');
  const [accessibleTables, setAccessibleTables] = useState<Set<string> | undefined>(undefined);
  const [configPanelOpen, setConfigPanelOpen] = useState(true);
  const [codePanelOpen, setCodePanelOpen] = useState(true);

  const validation = useMemo(() => validate(config, accessibleTables), [config, accessibleTables]);

  const formXmlService = useMemo(() => new FormXmlService(xrm), [xrm]);

  const configurePanelProps = {
    config,
    onChange,
    validation,
    metadataService,
    formXmlService,
    onAccessibleTablesChange: setAccessibleTables,
    metadataFilterConfig,
    defaultMetadataFilterConfig,
    metadataFilterPersistenceAvailable,
    metadataFilterError,
    onSaveMetadataFilterConfig,
    onResetMetadataFilterConfig,
  };
  const previewPanelProps = { config, validation, metadataService, xrm };
  const outputPanelProps = { config, xrm, validation };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.pageBg }}>
      <CommandBar onReset={onReset} />

      {layoutMode === 'wide' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <aside
            aria-label={configPanelOpen ? 'Config panel' : 'Config rail'}
            style={{
              width: configPanelOpen ? CONFIG_PANEL_WIDTH : COLLAPSED_RAIL_WIDTH,
              minWidth: configPanelOpen ? CONFIG_PANEL_MIN_WIDTH : COLLAPSED_RAIL_WIDTH,
              borderRight: `1px solid ${T.stroke1}`,
              overflow: configPanelOpen ? 'auto' : 'hidden',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              background: T.pageBg,
            }}
          >
            <RailToggle
              label={configPanelOpen ? 'Collapse config panel' : 'Expand config panel'}
              expanded={configPanelOpen}
              edge="left"
              onClick={() => setConfigPanelOpen(open => !open)}
            />
            {configPanelOpen ? (
              <ConfigurePanel {...configurePanelProps} />
            ) : (
              <RailLabel label="Config" />
            )}
          </aside>
          <section style={{ flex: 1, borderRight: `1px solid ${T.stroke1}`, minWidth: 300, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PreviewPanel {...previewPanelProps} />
          </section>
          <section
            aria-label={codePanelOpen ? 'Code panel' : 'Code rail'}
            style={{
              width: codePanelOpen ? CODE_PANEL_WIDTH : COLLAPSED_RAIL_WIDTH,
              minWidth: codePanelOpen ? CODE_PANEL_MIN_WIDTH : COLLAPSED_RAIL_WIDTH,
              overflow: codePanelOpen ? 'auto' : 'hidden',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              background: T.pageBg,
            }}
          >
            <RailToggle
              label={codePanelOpen ? 'Collapse code panel' : 'Expand code panel'}
              expanded={codePanelOpen}
              edge="right"
              onClick={() => setCodePanelOpen(open => !open)}
            />
            {codePanelOpen ? (
              <OutputPanel {...outputPanelProps} />
            ) : (
              <RailLabel label="Code" />
            )}
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
                  borderBottom: narrowTab === tab.id ? `2px solid ${T.accent}` : '2px solid transparent',
                  background: 'transparent',
                  color: narrowTab === tab.id ? T.accent : T.fg2,
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

function RailToggle({
  label,
  expanded,
  edge,
  onClick,
}: {
  label: string;
  expanded: boolean;
  edge: 'left' | 'right';
  onClick: () => void;
}): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const openGlyph = edge === 'left' ? '‹' : '›';
  const closedGlyph = edge === 'left' ? '›' : '‹';

  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      onClick={onClick}
      style={{
        width: COLLAPSED_RAIL_WIDTH,
        height: COLLAPSED_RAIL_WIDTH,
        border: 'none',
        borderBottom: `1px solid ${T.stroke1}`,
        background: T.surface2,
        color: T.fg1,
        cursor: 'pointer',
        fontFamily: T.font,
        fontSize: 22,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {expanded ? openGlyph : closedGlyph}
    </button>
  );
}

function RailLabel({ label }: { label: string }): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  return (
    <div
      aria-hidden="true"
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.fg2,
        fontFamily: T.font,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0,
        writingMode: 'vertical-rl',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
}
