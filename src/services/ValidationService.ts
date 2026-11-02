import { PaneDefinitionConfig, COMMAND_TRIGGERS, MAX_CONFIG_WIDTH, MIN_CONFIG_WIDTH, RECORD_TARGETS } from '../types/PaneDefinitionConfig';
import { isValidLogicalName, normalizeGuid } from './odataGuards';
import { parseFormData } from './formData';
import { isConfigWidthValid, isJsIdentifier } from './configGuards';
import { GENERATED_NAMES } from './CodeGenerationService';
import { allowedSources, allowedTargets, TRIGGER_CAPABILITIES } from './triggerCapabilities';

export interface ValidationError { field: string; message: string; }
export interface ValidationWarning { field: string; message: string; }
export interface ValidationResult { errors: ValidationError[]; warnings: ValidationWarning[]; isValid: boolean; }

/** Names the generated scripts declare or receive; the record variable may not shadow them. */
export const RESERVED_VARIABLES: readonly string[] = [...GENERATED_NAMES];

function pushJsonObjectError(errors: ValidationError[], data: string, message: string): void {
  try { parseFormData(data); } catch { errors.push({ field: 'target.data', message }); }
}

export function validate(config: PaneDefinitionConfig, accessibleTables?: Set<string>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const { pane, target, trigger, host, context, behavior } = config;
  const caps = TRIGGER_CAPABILITIES[trigger.kind];
  const { source } = context;
  const creating = target.pageType === 'entityrecord' && target.createNew === true;
  const sendsRecord = RECORD_TARGETS.includes(target.pageType) && source.kind !== 'none' && !creating;
  const hostTable = host.entityName.trim();

  // Pane
  if (!pane.paneId?.trim()) errors.push({ field: 'pane.paneId', message: 'Pane ID is required.' });
  if (!isConfigWidthValid(pane.width)) errors.push({ field: 'pane.width', message: `Pane width must be between ${MIN_CONFIG_WIDTH} and ${MAX_CONFIG_WIDTH} pixels.` });

  // The capability table is the owner; these only catch hand-edited configs.
  if (!allowedTargets(trigger.kind).includes(target.pageType)) {
    errors.push({ field: 'target.pageType', message: `${caps.label} cannot open this content type. Choose another.` });
  }
  if (!allowedSources(config).includes(source.kind)) {
    errors.push({ field: 'context.source', message: 'This record choice is not available for the selected trigger and content. Choose another record.' });
  }

  // Host is required where a picker or lookup preamble needs it.
  if (trigger.kind === 'FormOnChange') {
    if (!isValidLogicalName(hostTable)) errors.push({ field: 'host.entityName', message: 'Select the table whose column change opens the pane.' });
    if (!isValidLogicalName(host.attribute.trim())) errors.push({ field: 'host.attribute', message: 'Select the column to watch for changes.' });
  }
  if (trigger.kind === 'LookupTagClick') {
    if (!isValidLogicalName(hostTable)) errors.push({ field: 'host.entityName', message: 'Select the table whose lookup controls open the pane.' });
    if (host.lookupControls.length === 0) errors.push({ field: 'host.lookupControls', message: 'Select at least one lookup control.' });
    else if (!host.lookupControls.every(isValidLogicalName)) errors.push({ field: 'host.lookupControls', message: 'Lookup control names must be logical names.' });
  }
  if (source.kind === 'lookup') {
    if (!isValidLogicalName(hostTable)) errors.push({ field: 'host.entityName', message: 'Select the table that holds the lookup column.' });
    if (!isValidLogicalName(source.attribute.trim())) errors.push({ field: 'context.source.attribute', message: 'Select the lookup column whose record opens in the pane.' });
  }
  if (source.kind === 'fixed') {
    if (!normalizeGuid(source.id)) errors.push({ field: 'context.source.id', message: 'Enter the full GUID of the record to open.' });
    if (target.pageType !== 'entityrecord' && !isValidLogicalName(source.entityName.trim())) {
      errors.push({ field: 'context.source.entityName', message: "Select the record's table." });
    }
    warnings.push({ field: 'context.source', message: 'A fixed record ID is environment-specific. Reconfigure it after deploying to another environment.' });
  }
  if (sendsRecord) {
    const name = context.variableName.trim();
    if (!isJsIdentifier(name)) errors.push({ field: 'context.variableName', message: 'Variable name must be a valid JavaScript identifier.' });
    else if (RESERVED_VARIABLES.includes(name)) errors.push({ field: 'context.variableName', message: `${name} is used by the generated script. Choose another name.` });
  }

  // Target
  if ((target.pageType === 'custom' || target.pageType === 'webresource') && !target.name.trim()) {
    errors.push({ field: 'target.name', message: target.pageType === 'custom' ? 'Custom page name is required.' : 'Web resource name is required.' });
  }
  if (target.pageType === 'dashboard' && !target.dashboardId.trim()) errors.push({ field: 'target.dashboardId', message: 'Dashboard is required.' });
  if (target.pageType === 'entitylist') {
    if (!target.entityName.trim()) errors.push({ field: 'target.entityName', message: 'Table name is required.' });
    if (target.viewId.trim() && !normalizeGuid(target.viewId)) errors.push({ field: 'target.viewId', message: 'View ID must be a valid GUID.' });
    if (target.viewId.trim() && !['savedquery', 'userquery'].includes(target.viewType)) errors.push({ field: 'target.viewType', message: 'Select a view type when a view ID is set.' });
  }
  if (target.pageType === 'entityrecord') {
    // The other sources name the table at runtime; create mode and a fixed record need it here.
    if ((creating || source.kind === 'fixed') && !target.entityName.trim()) errors.push({ field: 'target.entityName', message: 'Table name is required.' });
    if (target.formId.trim() && !normalizeGuid(target.formId)) errors.push({ field: 'target.formId', message: 'Form ID must be a valid GUID.' });
    pushJsonObjectError(errors, target.data, 'Form data must be a JSON object.');
    if (creating && (source.kind === 'host' || source.kind === 'selectedRow')) {
      warnings.push({ field: 'target.createNew', message: 'Pre-fill copies only the columns that a relationship mapping between the two tables defines.' });
    }
  }
  if ((target.pageType === 'entityrecord' || target.pageType === 'entitylist') && target.entityName.trim() && accessibleTables && !accessibleTables.has(target.entityName.trim())) {
    warnings.push({ field: 'target.entityName', message: `Table "${target.entityName}" is no longer accessible in this app or for the current user.` });
  }
  if (target.pageType === 'generative') {
    if (!normalizeGuid(target.pageId)) errors.push({ field: 'target.pageId', message: 'Page ID must be the GUID of a generative page.' });
    pushJsonObjectError(errors, target.data, 'Page data must be a JSON object.');
    if (sendsRecord || target.data.trim()) {
      warnings.push({ field: 'target.pageType', message: 'recordId, entityName and data reach the page only if its prompt sets it up to accept input parameters.' });
    }
  }

  // Advisory
  if (pane.hideHeader && pane.canClose) warnings.push({ field: 'pane.hideHeader', message: 'Hiding the header also hides the close button, so users cannot dismiss the pane. The generated script emits canClose: false to match.' });
  if (pane.alwaysRender) warnings.push({ field: 'pane.alwaysRender', message: 'alwaysRender keeps the pane loaded even when inactive. This has a memory cost.' });
  if (trigger.kind === 'FormOnLoad' && pane.isSelected === false) warnings.push({ field: 'pane.isSelected', message: 'FormOnLoad with isSelected: false opens a background pane that may surprise users.' });
  if (target.pageType === 'webresource') warnings.push({ field: 'target.pageType', message: 'Web resources inside side panes cannot access Xrm or parent.Xrm.' });
  if (target.pageType === 'search') warnings.push({ field: 'target.pageType', message: 'Search is not a documented navigateTo pageType. Documented values are entitylist, entityrecord, dashboard, webresource, custom, and generative. Generated code may fail at runtime.' });
  if (trigger.kind === 'GridButton' && source.kind === 'selectedRow') {
    warnings.push({ field: 'context.source', message: 'The generated script uses the first selected row. It exits without opening a pane when no row is selected, and ignores rows beyond the first.' });
  }
  if (behavior.toggleIfOpen) {
    if (!COMMAND_TRIGGERS.includes(trigger.kind)) errors.push({ field: 'behavior.toggleIfOpen', message: 'Close if already open works only for command bar buttons. Any other trigger would close its own pane when it fires again.' });
    else if (pane.hideHeader || !pane.canClose) warnings.push({ field: 'behavior.toggleIfOpen', message: 'This pane has no close button, so the command button is the only way to close it.' });
  }
  const specialCharPattern = /['"\\]/;
  for (const sf of [
    { value: pane.paneId, field: 'pane.paneId', label: 'Pane ID' },
    { value: pane.title, field: 'pane.title', label: 'Title' },
    { value: trigger.namespace, field: 'trigger.namespace', label: 'Namespace' },
    { value: trigger.functionName, field: 'trigger.functionName', label: 'Function name' },
  ]) {
    if (sf.value && specialCharPattern.test(sf.value)) warnings.push({ field: sf.field, message: `${sf.label} contains special characters. These are safely escaped in generated code, but may indicate a copy-paste issue.` });
  }

  return { errors, warnings, isValid: errors.length === 0 };
}
