const LOGICAL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidLogicalName(value: string): boolean {
  return LOGICAL_NAME_PATTERN.test(value);
}

export function normalizeGuid(value: string): string | null {
  const normalized = value.trim().replace(/^\{|\}$/g, '').toLowerCase();
  return GUID_PATTERN.test(normalized) ? normalized : null;
}

export function escapeODataStringLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export function buildSystemFormsForEntityPath(entityLogicalName: string): string {
  return (
    `systemforms?$filter=objecttypecode eq '${escapeODataStringLiteral(entityLogicalName)}' and type eq 2` +
    `&$select=name,formid&$orderby=name asc`
  );
}

export function buildSystemFormXmlPath(formId: string): string | null {
  const normalizedFormId = normalizeGuid(formId);
  return normalizedFormId ? `systemforms(${normalizedFormId})?$select=formxml` : null;
}

export function buildEntityDefinitionsPath(): string {
  return (
    'EntityDefinitions' +
    '?$select=LogicalName,SchemaName,DisplayName,EntitySetName,ObjectTypeCode,' +
    'IsCustomEntity,IsActivity,IsIntersect,IsPrivate,OwnershipType,' +
    'CanCreateForms,CanModifyAdditionalSettings,IsCustomizable' +
    '&$filter=IsValidForAdvancedFind eq true and IsIntersect eq false and IsPrivate eq false'
  );
}

export function buildSystemDashboardsPath(): string {
  return 'systemdashboards?$select=name,dashboardid&$orderby=name asc';
}

export function buildUserDashboardsPath(): string {
  return 'userdashboards?$select=name,userdashboardid&$orderby=name asc';
}
