import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { normalizeGuid } from './odataGuards';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  isValid: boolean;
}

export function validate(config: PaneDefinitionConfig, accessibleTables?: Set<string>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Error: empty paneId
  if (!config.pane.paneId?.trim()) {
    errors.push({ field: 'pane.paneId', message: 'Pane ID is required.' });
  }

  // Error: custom pageType with empty name
  if (config.target.pageType === 'custom' && !config.target.name.trim()) {
    errors.push({ field: 'target.name', message: 'Custom page name is required.' });
  }

  // Error: webresource pageType with empty name (WR-003)
  if (config.target.pageType === 'webresource' && !config.target.name.trim()) {
    errors.push({ field: 'target.name', message: 'Web resource name is required.' });
  }

  // Error: entityrecord/entitylist with empty entityName
  if (
    (config.target.pageType === 'entityrecord' || config.target.pageType === 'entitylist') &&
    !config.target.entityName.trim()
  ) {
    errors.push({
      field: 'target.entityName',
      message: 'Table name is required.',
    });
  }

  if (
    (config.target.pageType === 'entityrecord' || config.target.pageType === 'entitylist') &&
    !!config.target.entityName.trim() &&
    accessibleTables &&
    !accessibleTables.has(config.target.entityName.trim())
  ) {
    warnings.push({
      field: 'target.entityName',
      message: `Table "${config.target.entityName}" is no longer accessible in this app or for the current user.`,
    });
  }

  // Warning: hideHeader + canClose — Microsoft publishes this combination (WR-009)
  if (config.pane.hideHeader && config.pane.canClose) {
    warnings.push({
      field: 'pane.hideHeader',
      message:
        'Hiding the header also hides the close button, so users cannot dismiss the pane. The generated script emits canClose: false to match.',
    });
  }

  // Warning: alwaysRender
  if (config.pane.alwaysRender) {
    warnings.push({
      field: 'pane.alwaysRender',
      message:
        'alwaysRender keeps the pane loaded even when inactive. This has a memory cost.',
    });
  }

  // Warning: FormOnLoad + isSelected: false
  if (config.trigger.kind === 'FormOnLoad' && config.pane.isSelected === false) {
    warnings.push({
      field: 'pane.isSelected',
      message:
        'FormOnLoad with isSelected: false opens a background pane that may surprise users.',
    });
  }

  // Error: dashboard with no dashboardId
  if (config.target.pageType === 'dashboard' && !config.target.dashboardId.trim()) {
    errors.push({ field: 'target.dashboardId', message: 'Dashboard is required.' });
  }

  // Warning: webresource pageType
  if (config.target.pageType === 'webresource') {
    warnings.push({
      field: 'target.pageType',
      message:
        'Web resources inside side panes cannot access Xrm or parent.Xrm.',
    });
  }

  // Warning: Static context mode
  if (config.context.mode === 'Static') {
    warnings.push({
      field: 'context.mode',
      message:
        'Static record IDs are environment-specific. You must reconfigure this field after deploying to another environment.',
    });
  }

  // Warning: SubgridButton + SelectedRow context
  if (config.trigger.kind === 'SubgridButton' && config.context.mode === 'SelectedRow') {
    warnings.push({
      field: 'context.mode',
      message:
        'SubgridButton with SelectedRow context requires a runtime row-guard in the generated code.',
    });
  }

  // Warning: MainGridButton + entityrecord — no single record context available
  if (
    config.trigger.kind === 'MainGridButton' &&
    config.target.pageType === 'entityrecord'
  ) {
    warnings.push({
      field: 'target.pageType',
      message:
        'MainGridButton opens the first selected row. The generated script exits without opening a pane when no row is selected, and ignores rows beyond the first.',
    });
  }

  // Error: entityrecord navigation that resolves its ID from configuration rather than
  // from the trigger. Mirrors buildConfiguredRecordIdExpression in CodeGenerationService —
  // without a normalizable GUID the generated script's only effect is to throw.
  if (
    config.target.pageType === 'entityrecord' &&
    (config.context.mode === 'Static' || config.trigger.kind === 'ManualJS')
  ) {
    const configuredId = config.context.staticRecordId || config.target.entityId;
    if (!normalizeGuid(configuredId)) {
      errors.push({
        field: 'context.staticRecordId',
        message: 'A valid record ID (GUID) is required — this trigger and context supply no record at runtime.',
      });
    }
  }


  if (config.trigger.kind === 'FormOnChange' && !config.trigger.fieldName?.trim()) {
    errors.push({
      field: 'trigger.fieldName',
      message: 'Field name is required for FormOnChange triggers.',
    });
  }


  const specialCharPattern = /['"\\]/;
  const stringFields: Array<{ value: string; field: string; label: string }> = [
    { value: config.pane.paneId, field: 'pane.paneId', label: 'Pane ID' },
    { value: config.pane.title, field: 'pane.title', label: 'Title' },
    { value: config.trigger.namespace, field: 'trigger.namespace', label: 'Namespace' },
    { value: config.trigger.functionName, field: 'trigger.functionName', label: 'Function name' },
  ];
  for (const sf of stringFields) {
    if (sf.value && specialCharPattern.test(sf.value)) {
      warnings.push({
        field: sf.field,
        message: `${sf.label} contains special characters. These are safely escaped in generated code, but may indicate a copy-paste issue.`,
      });
    }
  }

  // Policy: warn-without-blocking. Warnings are advisory; code generation and copy proceed regardless.
  // Blocking errors (isValid: false) require user action before code is usable.
  return {
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}
