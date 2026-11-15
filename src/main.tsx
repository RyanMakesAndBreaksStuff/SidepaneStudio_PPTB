import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidePaneBuilderWorkbench } from './SidePaneBuilderWorkbench';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StatusScreen } from './components/StatusScreen';

function ConnectionGuard(): React.ReactElement {
  const hasDataverseAPI = typeof window.dataverseAPI !== 'undefined';
  const hasToolboxAPI = typeof window.toolboxAPI !== 'undefined';
  if (!hasDataverseAPI || !hasToolboxAPI) {
    const missing = [];
    if (!hasDataverseAPI) missing.push('Dataverse API');
    if (!hasToolboxAPI) missing.push('Toolbox API');
    return (
      <StatusScreen
        icon="⚠"
        title={`${missing.join(' + ')} unavailable`}
        message="Open this tool inside a Power Platform Toolbox (PPTB) environment connected to Dataverse."
      />
    );
  }
  return <SidePaneBuilderWorkbench />;
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found.');

createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ConnectionGuard />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
