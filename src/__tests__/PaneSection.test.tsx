import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { PaneSection } from '../components/config/PaneSection';
import { ThemeProvider } from '../contexts/ThemeContext';
import { validate } from '../services/ValidationService';
import type { MetadataService } from '../services/MetadataService';
import { cfg } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

/** Renders the section with the warnings validation reports for the same config, as ConfigurePanel does. */
async function renderPane(imageSrc: string): Promise<void> {
  const config = cfg({ pane: { imageSrc } });
  const { errors, warnings } = validate(config);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(<ThemeProvider>
      <PaneSection config={config} onChange={() => {}} metadataService={{} as MetadataService}
        errors={Object.fromEntries(errors.map(e => [e.field, e.message]))}
        warnings={Object.fromEntries(warnings.map(w => [w.field, w.message]))} />
    </ThemeProvider>);
  });
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('PaneSection tab icon callout (W11)', () => {
  it('says the preview loads an accepted relative path', async () => {
    await renderPane('sps_/icons/pane.svg');
    expect(host?.textContent).toContain('Preview loads this image');
    expect(host?.textContent).not.toContain('Not emitted');
    expect(host?.textContent).not.toContain('placeholder');
  });

  it('says a rejected absolute path is not emitted', async () => {
    await renderPane('https://evil.test/x.svg');
    expect(host?.textContent).toContain('Not emitted: path must be relative to WebResources');
    expect(host?.textContent).not.toContain('Preview loads this image');
    expect(host?.textContent).not.toContain('placeholder');
  });

  it('shows no icon callout while the path is empty', async () => {
    await renderPane('');
    expect(host?.textContent).not.toContain('Preview loads this image');
    expect(host?.textContent).not.toContain('Not emitted');
  });
});
