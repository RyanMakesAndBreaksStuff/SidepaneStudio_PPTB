import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LookupControlsPicker } from '../components/config/LookupControlsPicker';
import type { LookupAttributeInfo } from '../services/MetadataService';
import { chooseOption } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(element); });
}
afterEach(async () => { if (root) await act(async () => { root?.unmount(); }); host?.remove(); root = undefined; host = undefined; });
const lookups: LookupAttributeInfo[] = [
  { LogicalName: 'parentaccountid', DisplayName: { UserLocalizedLabel: { Label: 'Parent Account' } }, Targets: ['account'] },
  { LogicalName: 'primarycontactid', DisplayName: { UserLocalizedLabel: { Label: 'Primary Contact' } }, Targets: ['contact'] },
];

describe('LookupControlsPicker', () => {
  it('adds, excludes, and removes lookup controls', async () => {
    const metadataService = { listLookupAttributes: vi.fn().mockResolvedValue(lookups) };
    const onChange = vi.fn();
    const element = (value: string[]) => <LookupControlsPicker entityName="account" value={value} onChange={onChange} metadataService={metadataService} />;
    await render(element([]));
    await chooseOption(host!, 'Add lookup control', 'Parent Account');
    expect(onChange).toHaveBeenCalledWith(['parentaccountid']);
    await act(async () => { root?.render(element(['parentaccountid'])); });
    const list = host!.querySelector('ul[aria-label="Selected lookup controls"]')!;
    expect(list.textContent).toContain('Parent Account');
    const input = host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Add lookup control"]')!;
    await act(async () => { input.focus(); });
    expect(host!.textContent).not.toContain('Parent Accountparentaccountid');
    await act(async () => { host!.querySelector<HTMLButtonElement>('[aria-label="Remove parentaccountid"]')!.click(); });
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('keeps unavailable saved controls visible', async () => {
    const metadataService = { listLookupAttributes: vi.fn().mockResolvedValue(lookups) };
    await render(<LookupControlsPicker entityName="account" value={['missing']} onChange={vi.fn()} metadataService={metadataService} />);
    expect(host!.querySelector('ul[aria-label="Selected lookup controls"]')?.textContent).toContain('missing (unavailable)');
  });
});
