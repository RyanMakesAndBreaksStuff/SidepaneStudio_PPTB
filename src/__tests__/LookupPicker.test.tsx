import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LookupPicker } from '../components/LookupPicker';
import { useLookupColumns } from '../components/useLookupColumns';
import type { LookupAttributeInfo } from '../services/MetadataService';
import { chooseOption } from './testHelpers';

const lookups: LookupAttributeInfo[] = [
  { LogicalName: 'primarycontactid', Targets: ['contact'] },
  { LogicalName: 'parentcustomerid', Targets: ['account', 'contact'] },
];

let root: Root | undefined;
let host: HTMLDivElement | undefined;

/** The caller's side of the contract: it loads the columns and hands them to the presentational picker. */
function Harness({ service, entityName, value, onChange, showDestination }: {
  service: Parameters<typeof useLookupColumns>[0];
  entityName: string;
  value: string;
  onChange: (logicalName: string, selection?: LookupAttributeInfo) => void;
  showDestination?: boolean;
}): React.ReactElement {
  const columns = useLookupColumns(service, entityName);
  return <LookupPicker columns={columns} entityName={entityName} value={value} onChange={onChange}
    showDestination={showDestination} />;
}

async function render(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root?.render(element); });
}

afterEach(async () => {
  if (root) await act(async () => { root?.unmount(); });
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('LookupPicker', () => {
  it('lists the columns its caller loaded and reports the chosen column with its metadata', async () => {
    const service = { listLookupAttributes: vi.fn().mockResolvedValue(lookups) };
    const onChange = vi.fn();
    await render(<Harness service={service} entityName="account" value="" onChange={onChange} />);
    await chooseOption(host!, 'Lookup column', 'primarycontactid');
    expect(service.listLookupAttributes).toHaveBeenCalledTimes(1);
    expect(service.listLookupAttributes).toHaveBeenCalledWith('account');
    expect(onChange).toHaveBeenCalledWith('primarycontactid', lookups[0]);
  });

  it('says a saved column is unavailable when the table does not list it', async () => {
    const service = { listLookupAttributes: vi.fn().mockResolvedValue(lookups) };
    await render(<Harness service={service} entityName="account" value="gone" onChange={vi.fn()} />);
    expect(host?.textContent).toContain('Saved lookup “gone” is unavailable on this source table.');
  });

  it('names the destination of the chosen column unless the caller states it elsewhere', async () => {
    const service = { listLookupAttributes: vi.fn().mockResolvedValue(lookups) };
    await render(<Harness service={service} entityName="account" value="primarycontactid" onChange={vi.fn()} />);
    expect(host?.textContent).toContain('Destination table: contact');
    await act(async () => {
      root?.render(<Harness service={service} entityName="account" value="primarycontactid" onChange={vi.fn()} showDestination={false} />);
    });
    expect(host?.textContent).not.toContain('Destination table: contact');
  });

  it('loads nothing and stays disabled until a source table is chosen', async () => {
    const service = { listLookupAttributes: vi.fn().mockResolvedValue(lookups) };
    await render(<Harness service={service} entityName="" value="" onChange={vi.fn()} />);
    const combo = host?.querySelector<HTMLInputElement>('[role="combobox"][aria-label="Lookup column"]');
    expect(combo?.disabled).toBe(true);
    expect(combo?.placeholder).toBe('Select a source table first');
    expect(service.listLookupAttributes).not.toHaveBeenCalled();
  });
});
