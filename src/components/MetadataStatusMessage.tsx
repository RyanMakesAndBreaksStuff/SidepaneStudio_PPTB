import * as React from 'react';
import type { MetadataRequest } from './useMetadataRequest';

export interface MetadataStatusMessageProps {
  request: Pick<MetadataRequest<unknown>, 'status' | 'error' | 'retry'>;
  disabled?: boolean;
  /** Shown while there is nothing to load; omitted means no message. */
  idleText?: string;
  /** Shown while the request is in flight; omitted means no message. */
  loadingText?: string;
  /** Appended to the failure reason before the Retry button. */
  errorDetail?: string;
}

/** The idle, loading, and failure-with-Retry lines shared by the metadata pickers. */
export function MetadataStatusMessage({ request, disabled, idleText, loadingText, errorDetail }: MetadataStatusMessageProps): React.ReactElement | null {
  switch (request.status) {
    case 'idle':
      return idleText ? <div role="status">{idleText}</div> : null;
    case 'loading':
      return loadingText ? <div role="status">{loadingText}</div> : null;
    case 'error':
      return (
        <div role="alert">
          {request.error}{errorDetail && ` ${errorDetail}`} <button type="button" disabled={disabled} onClick={request.retry}>Retry</button>
        </div>
      );
    case 'loaded':
      return null;
  }
}
