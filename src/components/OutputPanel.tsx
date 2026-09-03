// src/components/OutputPanel.tsx
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { ValidationResult } from '../services/ValidationService';
import { generateBasicScript, generateLibraryScript } from '../services/CodeGenerationService';
import { IXrmContext } from '../adapters/PptbContextAdapter';
import { CodeBlock } from './CodeBlock';
import { SummaryCard } from './SummaryCard';
import { Callout } from './Callout';
import { CommandStepsTab, TRIGGER_SUMMARIES, DEPLOY_STEPS } from './CommandStepsTab';
import { escapeHtml } from './previewHelpers';

export interface OutputPanelProps {
  config: PaneDefinitionConfig;
  xrm: IXrmContext;
  validation: ValidationResult;
}


import { RUNTIME_WEB_RESOURCE_NAME } from '../constants';

function generateRawConfig(config: PaneDefinitionConfig): string {
  return JSON.stringify(config, null, 2);
}

const TABS = [
  { id: 'basic',   label: 'Basic Script' },
  { id: 'library', label: 'Shared Library' },
  { id: 'command', label: 'Command Steps' },
];

export const OutputPanel = React.memo(function OutputPanel({ config, xrm, validation }: OutputPanelProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  const [activeTab, setActiveTab] = useState('basic');
  const [showRaw, setShowRaw] = useState(false);
  const [runtimeExists, setRuntimeExists] = useState<boolean | null>(null);
  const [runtimeCheckError, setRuntimeCheckError] = useState<string | null>(null);

  const basicCode   = useMemo(() => generateBasicScript(config), [config]);
  const libCode     = useMemo(() => generateLibraryScript(config), [config]);
  const rawCode     = useMemo(() => generateRawConfig(config), [config]);

  // Re-check runtime web resource every time the library tab is activated
  useEffect(() => {
    if (activeTab === 'library') {
      setRuntimeExists(null);
      setRuntimeCheckError(null);
      xrm.checkWebResourceExists(RUNTIME_WEB_RESOURCE_NAME)
        .then(exists => setRuntimeExists(exists))
        .catch((err) => setRuntimeCheckError(err instanceof Error ? err.message : String(err)));
    }
  }, [activeTab, xrm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.stroke1}`, padding: '0 6px', background: T.pageBg, flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '9px 12px 8px', border: 'none', background: 'transparent',
              fontFamily: T.font, fontSize: 12, fontWeight: 500,
              color: activeTab === tab.id ? T.accent : T.fg3,
              borderBottom: `2px solid ${activeTab === tab.id ? T.accent : 'transparent'}`,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 80ms, border-color 80ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Basic Script */}
        {activeTab === 'basic' && (
          <>
            <SummaryCard
              title="📋 What this script does"
              body={`Opens a side pane showing <strong>${escapeHtml(config.pane.title || 'Side Pane')}</strong>. ${TRIGGER_SUMMARIES[config.trigger.kind] || ''}`}
              steps={DEPLOY_STEPS[config.trigger.kind] || []}
            />
            {validation.errors.length > 0 && (
              <Callout type="err" icon="✕">
                Fix {validation.errors.length} validation error{validation.errors.length > 1 ? 's' : ''} before using this code: {validation.errors[0].message}
              </Callout>
            )}
            {config.behavior.closeOthers && (
              <Callout type="info" icon="ℹ">
                <strong>closeOthers is active:</strong> The generated script closes all other side panes after opening this one.
              </Callout>
            )}
            <CodeBlock code={basicCode} lang="js" />
          </>
        )}

        {/* Shared Library */}
        {activeTab === 'library' && (
          <>
            {runtimeCheckError && (
              <Callout type="err" icon="✕">
                <strong>Could not verify prerequisite:</strong> {runtimeCheckError}
              </Callout>
            )}
            {runtimeExists === false && !runtimeCheckError && (
              <Callout type="warn" icon="⚠">
                <strong>Prerequisite not detected:</strong> The shared runtime library (<code>{RUNTIME_WEB_RESOURCE_NAME}</code>) is not deployed in this environment. Deploy it before using this output.
              </Callout>
            )}
            {runtimeExists === true && (
              <Callout type="ok" icon="✓">Shared runtime library detected in this environment.</Callout>
            )}
            <SummaryCard
              title="📚 Shared library version"
              body={`Shorter snippet that calls the pre-deployed <strong>SidePaneHelper</strong> runtime. Your organization must deploy the shared library web resource first.`}
            />
            <CodeBlock code={libCode} lang="js" />
          </>
        )}

        {/* Command Steps */}
        {activeTab === 'command' && (
          <CommandStepsTab config={config} />
        )}

        {/* Advanced expander — Raw Config */}
        <div>
          <button
            onClick={() => setShowRaw(r => !r)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 0', border: 'none', background: 'transparent',
              fontFamily: T.font, fontSize: 12, fontWeight: 600,
              color: T.fg3, cursor: 'pointer',
            }}
          >
            <span style={{
              display: 'inline-block',
              transform: showRaw ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 180ms',
            }}>▾</span>
            Advanced — Raw Config
          </button>
          {showRaw && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Callout type="info" icon="ℹ">
                Resolved <code>PaneDefinitionConfig</code> — for debugging and diagnostics only.
              </Callout>
              <CodeBlock code={rawCode} lang="json" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
