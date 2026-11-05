import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from '../components/CodeBlock';
import { theme } from '../theme/tokens';

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

  // Regression pin for ffaacfa -> 5f95b64: tokenizing escaped text split `&#39;` and leaked it as visible text.
  const spanStyle = (text: string) =>
    Array.from(host?.querySelectorAll('pre span') ?? []).find(s => s.textContent === text)?.getAttribute('style');

  it('renders quotes, angle brackets, ampersands and entity-like text in JS strings and comments verbatim', async () => {
    const str = '"it\'s <b> & &#60; done"';
    const line = "// it's <i> & &#60; note";
    const block = "/* 'x' <y> & &#60; */";
    const code = `const msg = ${str}; ${line}\n${block}\nvar n = 39;`;

    await render(<CodeBlock code={code} lang="js" />);

    const pre = host?.querySelector('pre');
    expect(pre?.textContent).toBe(code);
    expect(pre?.querySelector('b, i, y')).toBeNull();
    expect(spanStyle(str)).toContain('#CE9178');
    expect(spanStyle(line)).toContain('#6A9955');
    expect(spanStyle(block)).toContain('#6A9955');
    expect(spanStyle('const')).toContain('#569CD6');
    expect(spanStyle('39')).toContain('#B5CEA8');
  });

  it('renders quotes, angle brackets, ampersands and entity-like text in JSON verbatim', async () => {
    const code = '{\n  "o\'key": "O\'Brien <x> & &#60;",\n  "count": 39,\n  "ok": true\n}';

    await render(<CodeBlock code={code} lang="json" />);

    const pre = host?.querySelector('pre');
    expect(pre?.textContent).toBe(code);
    expect(pre?.querySelector('x')).toBeNull();
    expect(spanStyle('"o\'key"')).toContain('#9CDCFE');
    expect(spanStyle('"O\'Brien <x> & &#60;"')).toContain('#CE9178');
    expect(spanStyle('39')).toContain('#B5CEA8');
    expect(spanStyle('true')).toContain('#569CD6');
  });

  it('renders plain text verbatim', async () => {
    const code = "it's <b> & &#60; done";

    await render(<CodeBlock code={code} lang="text" />);

    const pre = host?.querySelector('pre');
    expect(pre?.textContent).toBe(code);
    expect(pre?.querySelector('b')).toBeNull();
  });
  it('draws its chrome from the code-well tokens, not hard-coded greys', async () => {
    const T = theme(true);
    await render(<CodeBlock code="var n = 1;" lang="js" />);
    const well = host!.querySelector('pre')!.parentElement!.parentElement as HTMLElement;
    const header = well.firstElementChild as HTMLElement;
    const pre = host!.querySelector('pre') as HTMLElement;
    const rgb = (hex: string) => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
    expect(well.style.background).toBe(rgb(T.codeBg));
    expect(well.style.borderColor).toBe(rgb(T.codeStroke));
    expect(header.style.background).toBe(rgb(T.codeBg2));
    expect(pre.style.color).toBe(rgb(T.codeFg));
    expect((header.querySelector('span') as HTMLElement).style.color).toBe(rgb(T.codeAccent));
    expect(host!.innerHTML).not.toMatch(/#1E1E1E|#252526|#D4D4D4|#4EC9B0/i);
  });
});
