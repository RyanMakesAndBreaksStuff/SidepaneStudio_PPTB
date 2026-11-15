import { describe, it, expect } from 'vitest';
import {
  buildEntityDefinitionsPath,
  buildSystemDashboardsPath,
  buildSystemFormsForEntityPath,
  buildUserDashboardsPath,
  buildViewsForEntityPath,
} from '../services/odataGuards';

describe('OData path builders', () => {
  it('buildEntityDefinitionsPath returns EntityDefinitions query with correct filter', () => {
    const path = buildEntityDefinitionsPath();
    expect(path).toMatch(/^EntityDefinitions\?/);
    expect(path).toContain('IsValidForAdvancedFind eq true');
    expect(path).toContain('IsIntersect eq false');
    expect(path).toContain('IsPrivate eq false');
    expect(path).toContain('$select=');
    expect(path).toContain('LogicalName');
  });

  it('buildSystemDashboardsPath returns systemforms dashboard query', () => {
    const path = buildSystemDashboardsPath();
    expect(path).toMatch(/^systemforms\?/);
    expect(path).toContain('name');
    expect(path).toContain('formid');
    expect(path).toContain('type eq 0');
  });

  it('buildUserDashboardsPath returns userforms dashboard query', () => {
    const path = buildUserDashboardsPath();
    expect(path).toMatch(/^userforms\?/);
    expect(path).toContain('name');
    expect(path).toContain('userformid');
    expect(path).toContain('type eq 0');
  });

  it('buildSystemFormsForEntityPath lists active main forms only (r2 WR-002)', () => {
    expect(buildSystemFormsForEntityPath('account')).toBe(
      "systemforms?$filter=objecttypecode eq 'account' and type eq 2 and formactivationstate eq 1&$select=name,formid&$orderby=name asc");
  });

  it.each([['savedquery', 'savedqueries'], ['userquery', 'userqueries']] as const)(
    'buildViewsForEntityPath lists active %s rows only (r2 WR-002)', (viewType, collection) => {
      expect(buildViewsForEntityPath('account', viewType)).toBe(
        `${collection}?$select=name,${viewType}id,fetchxml,layoutxml&$filter=returnedtypecode eq 'account' and querytype eq 0 and statecode eq 0&$orderby=name asc`);
    });

  it('buildEntityDefinitionsPath requests no column the tool does not read (r2 PR-001)', () => {
    expect(buildEntityDefinitionsPath()).not.toContain('ObjectTypeCode');
  });
});
