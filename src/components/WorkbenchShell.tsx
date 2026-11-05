import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { MetadataFilterConfig } from '../types/MetadataFilterConfig';
import type { MetadataFilterDraft } from './config/MetadataFilterConfigEditor';
import { IXrmContext } from '../adapters/PptbContextAdapter';
import { MetadataService } from '../services/MetadataService';
import { FormXmlService } from '../services/FormXmlService';
import { validate } from '../services/ValidationService';
import { ConfigurePanel, type JumpRequest } from './ConfigurePanel';
import { SentenceSummary } from './config/SentenceSummary';
import type { SummarySlot } from '../services/describeConfig';
import { PreviewPanel } from './PreviewPanel';
import { OutputPanel } from './OutputPanel';
import { Callout } from './Callout';
import { PreviewSessionProvider } from '../contexts/PreviewSessionContext';

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
  /** Unsaved filter edits, owned above this shell so its remounts keep them. */
  metadataFilterDraft?: MetadataFilterDraft | null;
  onMetadataFilterDraftChange?: (draft: MetadataFilterDraft | null) => void;
  previewEpoch?: number;
  /** W20 — the restored config was saved for another environment and the user has not confirmed it here. */
  orgMismatch?: boolean;
  onConfirmOrgMismatch?: () => void;
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

function WorkbenchShellContent({
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
  metadataFilterDraft,
  onMetadataFilterDraftChange,
  orgMismatch = false,
  onConfirmOrgMismatch,
}: WorkbenchShellProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [narrowTab, setNarrowTab] = useState<NarrowTab>('configure');
  const [accessibleTables, setAccessibleTables] = useState<Set<string> | undefined>(undefined);
  const [configPanelOpen, setConfigPanelOpen] = useState(true);
  const [codePanelOpen, setCodePanelOpen] = useState(true);
  const [jumpRequest, setJumpRequest] = useState<JumpRequest | undefined>(undefined);
  const jump = (slot: SummarySlot) => {
    setNarrowTab('configure');
    setJumpRequest(prev => ({ slot, seq: (prev?.seq ?? 0) + 1 }));
  };

  const validation = useMemo(() => validate(config, accessibleTables, orgMismatch), [config, accessibleTables, orgMismatch]);

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
    metadataFilterDraft,
    onMetadataFilterDraftChange,
    jumpRequest,
  };
  const previewPanelProps = { config, onChange, validation, metadataService, xrm };
  const outputPanelProps = { config, xrm, validation, copyBlocked: orgMismatch };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.pageBg }}>
      {orgMismatch && (
        <div role="alert" style={{ padding: '8px 12px', borderBottom: `1px solid ${T.stroke1}`, flexShrink: 0 }}>
          <Callout type="warn" icon="⚠">
            This configuration was saved for a different environment; table, form, view and page selections are unverified.{' '}
            <button type="button" onClick={onConfirmOrgMismatch} style={{
              marginLeft: 4, padding: '2px 10px', border: `1px solid ${T.warning}`, borderRadius: T.rS,
              background: 'transparent', color: T.warning, fontFamily: T.font, fontSize: 12, cursor: 'pointer',
            }}>Use anyway</button>
          </Callout>
        </div>
      )}
      <SentenceSummary config={config} validation={validation} onJump={jump}
        actions={<ResetConfigButton onReset={onReset} />} />
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
            <PanelHeader title={configPanelOpen ? 'Configure' : undefined}>
              <RailToggle
                label={configPanelOpen ? 'Collapse config panel' : 'Expand config panel'}
                expanded={configPanelOpen}
                edge="left"
                onClick={() => setConfigPanelOpen(open => !open)}
              />
            </PanelHeader>
            {configPanelOpen ? (
              <ConfigurePanel {...configurePanelProps} />
            ) : (
              <RailLabel label="Config" />
            )}
          </aside>
          <section style={{ flex: 1, borderRight: `1px solid ${T.stroke1}`, minWidth: 300, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PanelHeader title="Preview" />
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
            <PanelHeader title={codePanelOpen ? 'Output' : undefined}>
              <RailToggle
                label={codePanelOpen ? 'Collapse code panel' : 'Expand code panel'}
                expanded={codePanelOpen}
                edge="right"
                onClick={() => setCodePanelOpen(open => !open)}
              />
            </PanelHeader>
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
            {narrowTab === 'preview' && <PreviewPanel {...previewPanelProps} />}
            {narrowTab === 'output'  && <OutputPanel {...outputPanelProps} />}
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkbenchShell(props: WorkbenchShellProps): React.ReactElement {
  return <PreviewSessionProvider key={props.previewEpoch ?? 0}>
    <WorkbenchShellContent {...props} />
  </PreviewSessionProvider>;
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

function ResetConfigButton({ onReset }: { onReset: () => void }): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const [hoverReset, setHoverReset] = useState(false);

  const handleReset = () => {
    if (!window.confirm('Reset all configuration? This cannot be undone.')) return;
    onReset();
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      onMouseEnter={() => setHoverReset(true)}
      onMouseLeave={() => setHoverReset(false)}
      style={{
        padding: '4px 12px',
        border: `1px solid ${T.stroke1}`,
        borderRadius: T.rS,
        background: hoverReset ? T.surface1 : 'transparent',
        color: T.fg2,
        fontFamily: T.font,
        fontSize: 12,
        cursor: 'pointer',
        transition: 'background 80ms',
      }}
    >
      ↺ Reset
    </button>
  );
}

/** Wide-layout counterpart of the narrow tab strip: keeps each panel's title visible. */
function PanelHeader({
  title,
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      minHeight: COLLAPSED_RAIL_WIDTH,
      borderBottom: `1px solid ${T.stroke1}`,
      background: T.surface2,
      flexShrink: 0,
    }}>
      {children}
      {title && (
        <h2 style={{
          margin: 0,
          padding: children ? '0 12px 0 0' : '0 16px',
          color: T.accent,
          fontFamily: T.font,
          fontSize: 13,
          fontWeight: 600,
        }}>
          {title}
        </h2>
      )}
    </div>
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
