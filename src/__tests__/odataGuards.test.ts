import { describe, it, expect } from 'vitest';
import {
  buildEntityDefinitionsPath,
  buildSystemDashboardsPath,
  buildUserDashboardsPath,
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
});
