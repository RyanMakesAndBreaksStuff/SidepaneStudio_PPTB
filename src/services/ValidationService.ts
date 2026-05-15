import { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';

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
  if (config.target.pageType === 'custom' && !config.target.name?.trim()) {
    errors.push({ field: 'target.name', message: 'Custom page name is required.' });
  }

  // Error: entityrecord/entitylist with empty entityName
  if (
    ['entityrecord', 'entitylist'].includes(config.target.pageType) &&
    !config.target.entityName?.trim()
  ) {
    errors.push({
      field: 'target.entityName',
      message: 'Table name is required.',
    });
  }

  if (
    ['entityrecord', 'entitylist'].includes(config.target.pageType) &&
    !!config.target.entityName?.trim() &&
    accessibleTables &&
    !accessibleTables.has(config.target.entityName.trim())
  ) {
    warnings.push({
      field: 'target.entityName',
      message: `Table "${config.target.entityName}" is no longer accessible in this app or for the current user.`,
    });
  }

  // Error: hideHeader + canClose
  if (config.pane.hideHeader && config.pane.canClose) {
    errors.push({
      field: 'pane.hideHeader',
      message:
        'When the header is hidden, users cannot close the pane. Set canClose to false or show the header.',
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
        'MainGridButton has no single-record context. The generated entityId will be empty — supply the record ID at runtime or switch to entitylist page type.',
    });
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
