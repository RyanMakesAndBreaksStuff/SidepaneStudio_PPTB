import { useCallback, useEffect, useState } from 'react';

/** Lifecycle of one metadata request: nothing to load, in flight, settled with data, or failed. */
export type MetadataStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** What a picker reports about its saved selection once the metadata request settles. */
export type PickerStatus = Exclude<MetadataStatus, 'loaded'> | 'unavailable' | 'empty' | 'resolved';

export interface MetadataRequest<T> {
  status: MetadataStatus;
  data: T | null;
  error: string | null;
  retry: () => void;
}

type Outcome<T> = { status: 'loaded'; data: T } | { status: 'error'; error: string };

interface Settled<T> {
  deps: readonly unknown[];
  attempt: number;
  outcome: Outcome<T>;
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/**
 * Runs `loader` when `deps` change or `retry` is called and exposes only the latest request's
 * response. A response for superseded deps, an earlier attempt, or an unmounted component is
 * dropped, and the render after a deps change already reports `loading` instead of the old data.
 * Pass `null` as the loader when there is nothing to load; the status is then `idle`.
 */
export function useMetadataRequest<T>(
  loader: (() => Promise<T>) | null,
  deps: readonly unknown[],
): MetadataRequest<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const idle = loader === null;

  useEffect(() => {
    if (!loader) return;
    let cancelled = false;
    const settle = (outcome: Outcome<T>) => {
      if (!cancelled) setSettled({ deps, attempt, outcome });
    };
    loader().then(
      data => settle({ status: 'loaded', data }),
      (err: unknown) => settle({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not load metadata.',
      }),
    );
    return () => { cancelled = true; };
    // The caller's deps describe the request; the loader closure is recreated every render.
  }, [...deps, idle, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  const outcome = !idle && settled?.attempt === attempt && sameDeps(settled.deps, deps)
    ? settled.outcome
    : null;

  return {
    status: idle ? 'idle' : outcome?.status ?? 'loading',
    data: outcome?.status === 'loaded' ? outcome.data : null,
    error: outcome?.status === 'error' ? outcome.error : null,
    retry,
  };
}
