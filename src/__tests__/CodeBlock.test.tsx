import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from '../components/CodeBlock';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(element);
  });
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  vi.restoreAllMocks();
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('CodeBlock', () => {
  it('renders JavaScript code text without leaking HTML entities', async () => {
    const code = 'await pane.navigate({ pageType: "entitylist", entityName: "contact" });\n<script>alert(\'x\')</script>';
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await render(<CodeBlock code={code} lang="js" />);

    const pre = host?.querySelector('pre');
    expect(pre?.textContent).toContain('pageType: "entitylist"');
    expect(pre?.innerHTML).toContain('&lt;script&gt;');
    expect(pre?.querySelector('script')).toBeNull();

    const copyButton = Array.from(host?.querySelectorAll('button') ?? []).find(
      b => b.textContent?.includes('Copy')
    );
    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(code);
  });
});
