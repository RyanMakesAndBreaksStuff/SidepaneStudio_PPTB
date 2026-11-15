import { describe, expect, it } from 'vitest';
import { filterTables } from '../components/previewHelpers';

describe('filterTables', () => {
  const tables = [
    { logicalName: 'zeta_account', displayName: 'Zeta Account' },
    { logicalName: 'contact', displayName: 'Contact' },
    { logicalName: 'account', displayName: 'Account' },
    { logicalName: 'new_acct', displayName: 'Big Account' },
  ];

  it('returns all tables unfiltered for an empty query', () => {
    expect(filterTables(tables, '  ').map(e => e.table.logicalName)).toEqual(tables.map(t => t.logicalName));
  });

  it('orders prefix matches first, then alphabetically by display name', () => {
    const names = filterTables(tables, 'acc').map(e => e.table.displayName);
    expect(names).toEqual(['Account', 'Big Account', 'Zeta Account']);
  });

  it('entries carry only the table', () => {
    expect(Object.keys(filterTables(tables, 'contact')[0])).toEqual(['table']);
  });
});
