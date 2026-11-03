// src/components/OutputPanel.tsx
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { ValidationResult } from '../services/ValidationService';
import { generateBasicScript, generateLibraryScript } from '../services/CodeGenerationService';
import { buildGenerativePagePrompt } from '../services/GenerativePagePromptService';
import { IXrmContext } from '../adapters/PptbContextAdapter';
import { CodeBlock } from './CodeBlock';
import { SummaryCard } from './SummaryCard';
import { Callout } from './Callout';
import { CommandStepsTab, deploySteps } from './CommandStepsTab';
import { describeConfigText } from '../services/describeConfig';
import runtimeSource from '../runtime/sidepane.runtime.js?raw';

export interface OutputPanelProps {
  config: PaneDefinitionConfig;
  xrm: IXrmContext;
  validation: ValidationResult;
  /** W20 — the config was restored from another environment's save; copying waits until the user confirms it. */
  copyBlocked?: boolean;
}


import { RUNTIME_FILE_NAME, RUNTIME_WEB_RESOURCE_NAME, RUNTIME_WEB_RESOURCE_SUFFIX } from '../constants';

function generateRawConfig(config: PaneDefinitionConfig): string {
  return JSON.stringify(config, null, 2);
}

const TABS = [
  { id: 'basic',   label: 'Basic Script' },
  { id: 'library', label: 'Shared Library' },
  { id: 'command', label: 'Command Steps' },
];
const PROMPT_TAB = { id: 'prompt', label: 'Page prompt' };

export const OutputPanel = React.memo(function OutputPanel({ config, xrm, validation, copyBlocked = false }: OutputPanelProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  const [activeTab, setActiveTab] = useState('basic');
  const [showRaw, setShowRaw] = useState(false);
  const [runtimeExists, setRuntimeExists] = useState<boolean | null>(null);
  const [runtimeName, setRuntimeName] = useState<string | null>(null);
  const [runtimeCheckError, setRuntimeCheckError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [savingRuntime, setSavingRuntime] = useState(false);

  const basicCode   = useMemo(() => generateBasicScript(config), [config]);
  const libCode     = useMemo(() => generateLibraryScript(config), [config]);
  const rawCode     = useMemo(() => generateRawConfig(config), [config]);
  const pagePrompt  = useMemo(() => buildGenerativePagePrompt(config), [config]);
  const tabs = config.target.pageType === 'generative' ? [...TABS, PROMPT_TAB] : TABS;
  // Changing the target can remove the tab that was open.
  const currentTab = tabs.some(tab => tab.id === activeTab) ? activeTab : 'basic';

  const downloadRuntime = async () => {
    setDownloadError(null);
    setSavingRuntime(true);
    try {
      if (window.toolboxAPI?.fileSystem?.saveFile) {
        await window.toolboxAPI.fileSystem.saveFile(RUNTIME_FILE_NAME, runtimeSource);
        return;
      }
      const url = URL.createObjectURL(new Blob([runtimeSource], { type: 'text/javascript;charset=utf-8' }));
      const anchor = document.createElement('a');
      try {
        anchor.href = url;
        anchor.download = RUNTIME_FILE_NAME;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingRuntime(false);
    }
  };

  // Re-check runtime web resource every time the library tab is activated
  useEffect(() => {
    if (activeTab === 'library') {
      setRuntimeExists(null);
      setRuntimeName(null);
      setRuntimeCheckError(null);
      xrm.checkWebResourceExists(RUNTIME_WEB_RESOURCE_SUFFIX)
        .then(name => {
          setRuntimeExists(Boolean(name));
          setRuntimeName(typeof name === 'string' ? name : null);
        })
        .catch((err) => setRuntimeCheckError(err instanceof Error ? err.message : String(err)));
    }
  }, [activeTab, xrm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.stroke1}`, padding: '0 6px', background: T.pageBg, flexShrink: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={currentTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '9px 12px 8px', border: 'none', background: 'transparent',
              fontFamily: T.font, fontSize: 12, fontWeight: 500,
              color: currentTab === tab.id ? T.accent : T.fg3,
              borderBottom: `2px solid ${currentTab === tab.id ? T.accent : 'transparent'}`,
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
        {copyBlocked && (
          <Callout type="warn" icon="⚠">Copy is disabled until you confirm the environment warning with <strong>Use anyway</strong>.</Callout>
        )}

        {/* Basic Script */}
        {currentTab === 'basic' && (
          <>
            <SummaryCard
              title="📋 What this script does"
              body={describeConfigText(config)}
              steps={deploySteps(config.trigger, 'basic')}
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
            {validation.errors.length === 0 && <CodeBlock code={basicCode} lang="js" copyDisabled={copyBlocked} />}
          </>
        )}

        {/* Shared Library */}
        {currentTab === 'library' && (
          <>
            <button type="button" onClick={downloadRuntime} disabled={savingRuntime}
              style={{ padding: '8px 12px', alignSelf: 'flex-start', fontFamily: T.font,
                color: T.fg1, background: T.surface1, border: `1px solid ${T.stroke1}`,
                borderRadius: T.rM, cursor: savingRuntime ? 'wait' : 'pointer' }}>
              {savingRuntime ? 'Saving runtime...' : 'Download runtime'}
            </button>
            {downloadError && <Callout type="err" icon="✕">Could not download runtime: {downloadError}</Callout>}
            {runtimeCheckError && (
              <Callout type="err" icon="✕">
                <strong>Could not verify prerequisite:</strong> {runtimeCheckError}
              </Callout>
            )}
            {runtimeExists === false && !runtimeCheckError && (
              <Callout type="warn" icon="⚠">
                <strong>Prerequisite not detected:</strong> No web resource ending in <code>{RUNTIME_WEB_RESOURCE_SUFFIX}</code> was found in this environment. Deploy the shared runtime (recommended name: <code>{RUNTIME_WEB_RESOURCE_NAME}</code>) before using this output.
              </Callout>
            )}
            {runtimeExists === true && (
              <Callout type="ok" icon="✓">Shared runtime library detected in this environment{runtimeName && <> (<code>{runtimeName}</code>)</>}.</Callout>
            )}
            <SummaryCard
              title="📚 Shared library version"
              body={<>Shorter snippet that calls the pre-deployed <strong>SidePaneHelper</strong> runtime.</>}
              steps={deploySteps(config.trigger, 'library')}
            />
            {validation.errors.length > 0 && (
              <Callout type="err" icon="✕">
                Fix {validation.errors.length} validation error{validation.errors.length > 1 ? 's' : ''} before using this code: {validation.errors[0].message}
              </Callout>
            )}
            {validation.errors.length === 0 && <CodeBlock code={libCode} lang="js" copyDisabled={copyBlocked} />}
          </>
        )}

        {/* Command Steps */}
        {currentTab === 'command' && (
          <CommandStepsTab config={config} />
        )}

        {/* Page prompt — generative targets only */}
        {currentTab === 'prompt' && (
          <>
            <SummaryCard
              title="✨ Generative page prompt"
              body="Add this to the page's prompt in the app agent so the page accepts what this script sends. The agent is not deterministic: test the page after it regenerates."
            />
            {pagePrompt
              ? <CodeBlock code={pagePrompt} lang="text" copyDisabled={copyBlocked} />
              : <Callout type="info" icon="ℹ">This script sends no input parameters, so the page needs no prompt changes for them.</Callout>}
          </>
        )}

        {/* Advanced expander — Raw Config.
            Gated on validation.errors.length === 0, same as the basic/library tabs, for
            consistency: the Copy/CodeBlock affordance is withheld whenever there are
            blocking validation errors, regardless of warnings. */}
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
              {validation.errors.length === 0 && <CodeBlock code={rawCode} lang="json" copyDisabled={copyBlocked} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
