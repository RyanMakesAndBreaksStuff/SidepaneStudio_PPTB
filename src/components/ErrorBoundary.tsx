import * as React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

const SHELL: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif",
  background: '#1A1A1A', color: '#E8E8E8', flexDirection: 'column', gap: 12,
};

/**
 * Last-resort recovery. Without this, a bad stored config or a render defect leaves a
 * blank page with no route back to Reset. Resetting clears the persisted config first,
 * so the reload does not reproduce the same crash.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Side Pane Studio crashed', error, info.componentStack);
  }

  private handleReset = (): void => {
    Promise.resolve(window.toolboxAPI?.settings?.set('lastConfig', null))
      .catch((err: unknown) => console.error('Failed to clear stored config', err))
      .finally(() => window.location.reload());
  };

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div style={SHELL}>
        <div style={{ fontSize: 32 }}>⚠</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Side Pane Studio hit an unexpected error</div>
        <div style={{ fontSize: 13, color: '#808080', maxWidth: 380, textAlign: 'center' }}>
          {this.state.error.message}
        </div>
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            padding: '6px 14px', border: '1px solid #3A3A3A', borderRadius: 4,
            background: 'transparent', color: '#E8E8E8', fontSize: 12, cursor: 'pointer',
          }}
        >
          ↺ Reset configuration and reload
        </button>
      </div>
    );
  }
}
