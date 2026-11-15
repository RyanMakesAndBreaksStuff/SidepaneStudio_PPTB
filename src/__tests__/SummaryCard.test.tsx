import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { SummaryCard } from '../components/SummaryCard';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

it('renders body and step text containing markup as literal text', async () => {
  const payload = '<img src=x onerror=alert(1)>';
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(<SummaryCard title="t" body={payload} steps={[payload, <React.Fragment key="k">safe <strong>bold</strong></React.Fragment>]} />);
  });
  expect(host.querySelector('img')).toBeNull();
  expect(host.textContent).toContain(payload);
  expect(host.querySelector('strong')?.textContent).toBe('bold');
});
