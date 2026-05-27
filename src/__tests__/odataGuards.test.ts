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

  it('buildSystemDashboardsPath returns systemdashboards with name and dashboardid', () => {
    const path = buildSystemDashboardsPath();
    expect(path).toMatch(/^systemdashboards\?/);
    expect(path).toContain('name');
    expect(path).toContain('dashboardid');
  });

  it('buildUserDashboardsPath returns userdashboards with name and userdashboardid', () => {
    const path = buildUserDashboardsPath();
    expect(path).toMatch(/^userdashboards\?/);
    expect(path).toContain('name');
    expect(path).toContain('userdashboardid');
  });
});
