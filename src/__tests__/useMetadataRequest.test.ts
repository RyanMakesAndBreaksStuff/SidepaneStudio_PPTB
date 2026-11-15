import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMetadataRequest, type MetadataRequest } from '../components/useMetadataRequest';

function controlled<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

interface ProbeProps {
  loader: (() => Promise<string>) | null;
  deps: unknown[];
  report: (request: MetadataRequest<string>) => void;
}

function Probe({ loader, deps, report }: ProbeProps): null {
  report(useMetadataRequest(loader, deps));
  return null;
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;
const report = vi.fn<(request: MetadataRequest<string>) => void>();

function latest(): MetadataRequest<string> {
  const call = report.mock.lastCall;
  if (!call) throw new Error('Probe has not rendered');
  return call[0];
}

async function render(loader: ProbeProps['loader'], deps: unknown[]) {
  if (!root) {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => { root?.render(React.createElement(Probe, { loader, deps, report })); });
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
  report.mockReset();
});

describe('useMetadataRequest', () => {
  it('is idle without a loader and loads data when one is supplied', async () => {
    await render(null, ['']);
    expect(latest()).toMatchObject({ status: 'idle', data: null, error: null });

    const request = controlled<string>();
    const loader = vi.fn(() => request.promise);
    await render(loader, ['account']);
    expect(latest()).toMatchObject({ status: 'loading', data: null, error: null });
    await act(async () => { request.resolve('columns'); });
    expect(latest()).toMatchObject({ status: 'loaded', data: 'columns', error: null });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reports loading as soon as deps change and ignores the superseded response', async () => {
    const first = controlled<string>();
    const second = controlled<string>();
    const third = controlled<string>();
    await render(() => first.promise, ['account']);
    await act(async () => { first.resolve('account data'); });
    expect(latest()).toMatchObject({ status: 'loaded', data: 'account data' });

    await render(() => second.promise, ['contact']);
    expect(latest()).toMatchObject({ status: 'loading', data: null });

    await render(() => third.promise, ['lead']);
    await act(async () => { third.resolve('lead data'); });
    await act(async () => { second.resolve('stale contact data'); });
    expect(latest()).toMatchObject({ status: 'loaded', data: 'lead data' });
  });

  it('ignores a response that settles after unmount', async () => {
    const request = controlled<string>();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await render(() => request.promise, ['account']);
      const rendersBeforeUnmount = report.mock.calls.length;
      await act(async () => { root?.unmount(); });
      root = undefined;
      await act(async () => { request.resolve('late'); });
      expect(report.mock.calls.length).toBe(rendersBeforeUnmount);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('retry re-runs the loader, reports loading, and drops the earlier attempt', async () => {
    const attempts = [controlled<string>(), controlled<string>(), controlled<string>()];
    const loader = vi.fn()
      .mockReturnValueOnce(attempts[0].promise)
      .mockReturnValueOnce(attempts[1].promise)
      .mockReturnValueOnce(attempts[2].promise);
    await render(loader, ['account']);
    await act(async () => { attempts[0].reject(new Error('offline')); });
    expect(latest()).toMatchObject({ status: 'error', data: null, error: 'offline' });

    await act(async () => { latest().retry(); });
    expect(latest()).toMatchObject({ status: 'loading', error: null });
    await act(async () => { latest().retry(); });
    await act(async () => { attempts[2].resolve('fresh'); });
    await act(async () => { attempts[1].resolve('stale retry'); });
    expect(latest()).toMatchObject({ status: 'loaded', data: 'fresh', error: null });
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('reports a generic reason when the loader rejects with a non-Error value', async () => {
    const request = controlled<string>();
    await render(() => request.promise, ['account']);
    await act(async () => { request.reject('offline'); });
    expect(latest()).toMatchObject({ status: 'error', error: 'Could not load metadata.' });
  });
});
