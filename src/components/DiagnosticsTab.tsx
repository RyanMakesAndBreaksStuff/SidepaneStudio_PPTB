// src/components/DiagnosticsTab.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { Callout } from './Callout';

export interface DiagnosticsTabProps {
  previewError?: string;
  previewSuccess?: boolean;
  paneId?: string;
  lastError?: { status: number; hint: string } | null;
}

export function DiagnosticsTab({ previewError, previewSuccess, paneId, lastError }: DiagnosticsTabProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  return (
    <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.fg1 }}>Diagnostics</div>

      {lastError && (
        <>
          {lastError.status === 403 && (
            <Callout type="err" icon="✕">
              <strong>Access denied (403)</strong> — {lastError.hint}
            </Callout>
          )}
          {lastError.status === 404 && (
            <Callout type="warn" icon="⚠">
              <strong>Tables not found (404)</strong> — {lastError.hint}
            </Callout>
          )}
          {lastError.status !== 403 && lastError.status !== 404 && (
            <Callout type="err" icon="✕">
              <strong>Data error ({lastError.status})</strong> — {lastError.hint}
            </Callout>
          )}
        </>
      )}

      {!previewError && !previewSuccess && (
        <>
          <Callout type="info" icon="ℹ">
            Live Preview diagnostics appear here after a preview run. Start a Live Preview from the command bar to capture pane creation and navigation results.
          </Callout>
          <div style={{ padding: '32px 0', textAlign: 'center', color: T.fg3, fontSize: 13 }}>
            No sessions recorded yet.
          </div>
        </>
      )}

      {previewSuccess && paneId && (
        <Callout type="ok" icon="✓">
          Pane <code style={{ fontFamily: 'monospace' }}>{paneId}</code> created and navigated successfully.
        </Callout>
      )}

      {previewSuccess && !paneId && (
        <Callout type="ok" icon="✓">
          Preview launched (pane ID unavailable).
        </Callout>
      )}

      {previewError && (
        <Callout type="err" icon="✕">
          Preview failed: {previewError}
        </Callout>
      )}
    </div>
  );
}
