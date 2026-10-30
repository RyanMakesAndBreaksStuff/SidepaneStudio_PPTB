import type { LookupAttributeInfo } from './MetadataService';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { isValidLogicalName } from './odataGuards';

/** Switches the table that owns the lookup and invalidates dependent choices. */
export function changeRelatedSource(
  config: PaneDefinitionConfig,
  source: string,
): PaneDefinitionConfig {
  if (config.context.mode !== 'RelatedRecord' || config.context.entityName === source) return config;

  const target = config.target.pageType === 'entityrecord'
    ? { ...config.target, entityName: '', formId: '', tabName: '' }
    : config.target;

  return {
    ...config,
    target,
    context: { ...config.context, entityName: source, lookupAttribute: '' },
  };
}

/** Applies successful lookup metadata to the current RelatedRecord destination. */
export function applyRelatedLookup(
  config: PaneDefinitionConfig,
  source: string,
  lookup: LookupAttributeInfo | null,
): PaneDefinitionConfig {
  if (config.context.mode !== 'RelatedRecord' || config.context.entityName !== source) return config;

  const lookupAttribute = lookup?.LogicalName ?? '';
  const targets = [...new Set((Array.isArray(lookup?.Targets) ? lookup.Targets : [])
    .filter(target => typeof target === 'string' && isValidLogicalName(target)))];
  const destination = targets.length === 1 ? targets[0] : '';
  const contextChanged = config.context.lookupAttribute !== lookupAttribute;

  if (config.target.pageType !== 'entityrecord') {
    if (!contextChanged) return config;
    return { ...config, context: { ...config.context, lookupAttribute } };
  }

  const destinationChanged = config.target.entityName !== destination;
  const shouldClearForm = contextChanged || destinationChanged;
  if (!contextChanged && !destinationChanged && !config.target.formId && !config.target.tabName) return config;

  return {
    ...config,
    context: { ...config.context, lookupAttribute },
    target: {
      ...config.target,
      entityName: destination,
      ...(shouldClearForm ? { formId: '', tabName: '' } : {}),
    },
  };
}
