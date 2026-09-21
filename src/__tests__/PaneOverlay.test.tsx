import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { PaneOverlay } from '../components/PaneOverlay';
import { getPreviewPaneWidth, getSafePreviewImageSrc } from '../components/previewHelpers';
import { getFlTokens } from '../components/flTokens';
import { ThemeContext } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { DEFAULT_CONFIG } from '../types/PaneDefinitionConfig';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function normalizeCssColor(value: string): string {
  const element = document.createElement('div');
  element.style.color = value;
  return element.style.color;
}

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
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('preview helpers', () => {
  it('scales pane widths across the full 300 to 1200 config range', () => {
    // Two-segment linear interpolation: [300→120, 1000→270] then [1000→270, 1200→300]
    expect(getPreviewPaneWidth(300)).toBe(120);
    expect(getPreviewPaneWidth(1000)).toBe(270);
    expect(getPreviewPaneWidth(1200)).toBe(300);
  });

  for (const source of [
    'http://example.test/icon.svg',
    'https://example.test/icon.svg',
    '//example.test/icon.svg',
    'data:image/svg+xml;base64,AAAA',
    'javascript:alert(1)',
  ]) {
    it(`blocks unsafe preview image source ${source}`, () => {
      expect(getSafePreviewImageSrc(source)).toBeNull();
    });
  }
});

describe('PaneOverlay', () => {
  it('maps muted preview text to accentAlt in dark mode and the requested light color', () => {
    const darkTokens = getFlTokens(theme(true), true);
    const lightTokens = getFlTokens(theme(false), false);

    expect(darkTokens.fgMuted).toBe(theme(true).accentAlt);
    expect(darkTokens.fgLabel).toBe(theme(true).accentAlt);
    expect(darkTokens.tabFg).toBe(theme(true).accentAlt);
    expect(lightTokens.fgMuted).toBe('#5BD08D');
    expect(lightTokens.fgLabel).toBe('#5BD08D');
    expect(lightTokens.tabFg).toBe('#5BD08D');
  });

  it('renders the pane label with the active theme muted color', async () => {
    const paneLabel = () => Array.from(host?.querySelectorAll<HTMLElement>('div') ?? [])
      .find(element => element.textContent === 'Custom Page');

    await render(
      <ThemeContext.Provider value={{ isDark: true }}>
        <PaneOverlay
          pane={DEFAULT_CONFIG.pane}
          target={DEFAULT_CONFIG.target}
          validation={{ isValid: true, errors: [], warnings: [] }}
        />
      </ThemeContext.Provider>
    );
    expect(paneLabel()?.style.color).toBe(normalizeCssColor(theme(true).accentAlt));

    await act(async () => {
      root?.render(
        <ThemeContext.Provider value={{ isDark: false }}>
          <PaneOverlay
            pane={DEFAULT_CONFIG.pane}
            target={DEFAULT_CONFIG.target}
            validation={{ isValid: true, errors: [], warnings: [] }}
          />
        </ThemeContext.Provider>
      );
    });
    expect(paneLabel()?.style.color).toBe(normalizeCssColor('#5BD08D'));
  });

  it('does not render an img for blocked image sources', async () => {
    await render(
      <PaneOverlay
        pane={{ ...DEFAULT_CONFIG.pane, imageSrc: 'https://example.test/icon.svg' }}
        target={DEFAULT_CONFIG.target}
        validation={{ isValid: true, errors: [], warnings: [] }}
      />
    );

    expect(host?.querySelector('img')).toBeNull();
  });
});
