import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColumnPicker } from '../components/config/ColumnPicker';
import type { AttributeLabel } from '../services/MetadataService';
import { chooseOption, deferred } from './testHelpers';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
async function render(element: React.ReactElement) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(element); });
}
afterEach(async () => { if (root) await act(async () => { root?.unmount(); }); host?.remove(); root = undefined; host = undefined; });

const columns: AttributeLabel[] = [
  { LogicalName: 'name', DisplayName: { UserLocalizedLabel: { Label: 'Account Name' } } },
  { LogicalName: 'accountnumber', DisplayName: { UserLocalizedLabel: { Label: 'Account Number' } } },
];

describe('ColumnPicker', () => {
  it('shows idle and loading states, sorts labels, and commits a logical name', async () => {
    const pending = deferred<AttributeLabel[]>();
    const metadataService = { listAttributeLabels: vi.fn(() => pending.promise) };
    const onChange = vi.fn();
    const element = (entityName: string) => <ColumnPicker entityName={entityName} value="" onChange={onChange} metadataService={metadataService} />;
    await render(element(''));
    expect(host?.textContent).toContain('Select a table first');
    await act(async () => { root?.render(element('account')); });
    expect(host?.textContent).toContain('Loading columns…');
    await act(async () => { pending.resolve(columns); });
    const input = host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Column"]')!;
    await act(async () => { input.focus(); });
    const options = Array.from(host!.querySelectorAll('[role="option"]'));
    expect(options.map(option => option.textContent)).toEqual(['Account Name' + 'name', 'Account Number' + 'accountnumber']);
    await chooseOption(host!, 'Column', 'Account Number');
    expect(onChange).toHaveBeenCalledWith('accountnumber');
  });

  it('marks an unavailable saved value and retries a failed load', async () => {
    const metadataService = { listAttributeLabels: vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(columns) };
    await render(<ColumnPicker entityName="account" value="missing" onChange={vi.fn()} metadataService={metadataService} />);
    expect(host?.textContent).toContain('offline');
    await act(async () => { host!.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(); });
    const input = host!.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Column"]')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(host?.textContent).toContain('Saved column “missing” is unavailable on this table.');
    expect(metadataService.listAttributeLabels).toHaveBeenCalledTimes(2);
  });
});
