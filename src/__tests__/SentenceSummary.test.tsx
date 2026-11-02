import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SentenceSummary } from '../components/config/SentenceSummary';
import { ThemeProvider } from '../contexts/ThemeContext';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';
import { describeConfigText } from '../services/describeConfig';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('SentenceSummary', () => {
  it('renders the sentence, marks errors and warnings, and jumps to a slot', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onJump = vi.fn();
    await act(async () => {
      root?.render(<ThemeProvider><SentenceSummary config={DEFAULT_CONFIG}
        validation={{ isValid: false, errors: [{ field: 'a', message: 'A' }, { field: 'b', message: 'B' }],
          warnings: [{ field: 'c', message: 'C' }] }} onJump={onJump} /></ThemeProvider>);
    });
    const region = host.querySelector('[role="region"][aria-label="Configuration summary"]');
    expect(region).toBeTruthy();
    expect(region?.textContent).toContain(describeConfigText(DEFAULT_CONFIG));
    expect(region?.querySelector('[role="status"]')?.textContent).toBe('2 errors · 1 warning');
    await act(async () => { region?.querySelector<HTMLButtonElement>('[data-slot="host"]')?.click(); });
    expect(onJump).toHaveBeenCalledWith('host');
  });
});
