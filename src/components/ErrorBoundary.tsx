import * as React from 'react';
import { copyText } from '../services/clipboard';

interface ErrorBoundaryState {
  error: Error | null;
  resetError: string | null;
  copyStatus: 'idle' | 'copied' | 'failed';
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Replaces the full-page fallback so a crash can be contained inside one panel. */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
}

const SHELL: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
  background: '#1A1A1A', color: '#E8E8E8', flexDirection: 'column', gap: 12,
};

const BUTTON: React.CSSProperties = {
  padding: '6px 14px', border: '1px solid #3A3A3A', borderRadius: 4,
  background: 'transparent', color: '#E8E8E8', fontSize: 12, cursor: 'pointer',
};

const PRIMARY_BUTTON: React.CSSProperties = {
  ...BUTTON, background: '#E8E8E8', color: '#1A1A1A', border: '1px solid #E8E8E8', fontWeight: 600,
};

function errorDetails(error: Error, resetError: string | null): string {
  return [
    `Error: ${error.message}`,
    resetError ? `Reset failure: ${resetError}` : '',
    error.stack ?? '',
  ].filter(Boolean).join('\n\n');
}

/** The Clipboard API can be blocked in the host webview, so try a transient textarea next. */
async function copyWithTextareaFallback(text: string): Promise<boolean> {
  try {
    await copyText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    try {
      area.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

/**
 * Last-resort recovery. "Try again" re-renders the children and touches nothing stored. "Reset configuration"
 * clears the persisted config, then re-renders the children, which rehydrate defaults when they mount. The page is
 * never reloaded: the host sends its context only at launch, so a reloaded tool cannot reach any host API until it is
 * closed and reopened. A failed clear is surfaced and the error stays up.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetError: null, copyStatus: 'idle' };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Side Pane Studio crashed', error, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ error: null, resetError: null, copyStatus: 'idle' });
  };

  private handleReset = async (): Promise<void> => {
    try {
      await window.toolboxAPI?.settings?.set('lastConfig', null);
    } catch (err: unknown) {
      console.error('Failed to clear stored config', err);
      this.setState({ resetError: err instanceof Error ? err.message : String(err) });
      return;
    }
    this.retry();
  };

  private handleCopy = async (): Promise<void> => {
    const { error, resetError } = this.state;
    if (!error) return;
    const ok = await copyWithTextareaFallback(errorDetails(error, resetError));
    this.setState({ copyStatus: ok ? 'copied' : 'failed' });
  };

  render(): React.ReactNode {
    const { error, resetError, copyStatus } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.retry);
    return (
      <div style={SHELL}>
        <div style={{ fontSize: 32 }}>⚠</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Side Pane Studio hit an unexpected error</div>
        <div style={{ fontSize: 13, color: '#808080', maxWidth: 380, textAlign: 'center' }}>
          {error.message}
        </div>
        {resetError && (
          <div role="alert" style={{ fontSize: 13, color: '#F0A0A0', maxWidth: 380, textAlign: 'center' }}>
            Could not clear the saved configuration: {resetError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={this.retry} style={PRIMARY_BUTTON}>
            Try again
          </button>
          <button type="button" onClick={this.handleReset} style={BUTTON}>
            Reset configuration
          </button>
          {resetError && (
            <button type="button" onClick={this.handleCopy} style={BUTTON}>
              {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy error details'}
            </button>
          )}
        </div>
      </div>
    );
  }
}
