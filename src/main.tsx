import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidePaneBuilderWorkbench } from './SidePaneBuilderWorkbench';

function ConnectionGuard(): React.ReactElement {
  const hasDataverseAPI = typeof window.dataverseAPI !== 'undefined';
  const hasToolboxAPI = typeof window.toolboxAPI !== 'undefined';
  if (!hasDataverseAPI || !hasToolboxAPI) {
    const missing = [];
    if (!hasDataverseAPI) missing.push('Dataverse API');
    if (!hasToolboxAPI) missing.push('Toolbox API');
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: '#1A1A1A',
        color: '#E8E8E8',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>⚠</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{missing.join(' + ')} unavailable</div>
        <div style={{ fontSize: 13, color: '#808080', maxWidth: 340, textAlign: 'center' }}>
          Open this tool inside a Power Platform Toolbox (PPTB) environment connected to Dataverse.
        </div>
      </div>
    );
  }
  return <SidePaneBuilderWorkbench />;
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found.');

createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider>
      <ConnectionGuard />
    </ThemeProvider>
  </React.StrictMode>
);
