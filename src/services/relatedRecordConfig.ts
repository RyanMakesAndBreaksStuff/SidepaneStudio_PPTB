import type { LookupAttributeInfo } from './MetadataService';
import type { PaneDefinitionConfig } from '../types/PaneDefinitionConfig';
import { isValidLogicalName } from './odataGuards';
import { coerceConfig } from './triggerCapabilities';

/** Switches the host table and invalidates every choice that depended on it. */
export function changeHostTable(config: PaneDefinitionConfig, entityName: string): PaneDefinitionConfig {
  if (config.host.entityName === entityName) return config;
  const source = config.context.source.kind === 'lookup' ? { kind: 'lookup' as const, attribute: '' } : config.context.source;
  const target = config.target.pageType === 'entityrecord' && !config.target.createNew && config.context.source.kind === 'lookup'
    ? { ...config.target, entityName: '', formId: '', tabName: '', data: '' }
    : config.target;
  return coerceConfig({
    ...config,
    host: { entityName, formId: '', viewId: '', viewType: '', attribute: '', lookupControls: [] },
    context: { ...config.context, source },
    target,
  });
}

/** Applies lookup metadata for the current host to a lookup source and derives the Table record destination. */
export function applyLookup(config: PaneDefinitionConfig, hostEntity: string, lookup: LookupAttributeInfo | null): PaneDefinitionConfig {
  if (config.context.source.kind !== 'lookup' || config.host.entityName !== hostEntity) return config;

  const attribute = lookup?.LogicalName ?? '';
  const targets = [...new Set((Array.isArray(lookup?.Targets) ? lookup.Targets : [])
    .filter(target => typeof target === 'string' && isValidLogicalName(target)))];
  const destination = targets.length === 1 ? targets[0] : '';
  const attributeChanged = config.context.source.attribute !== attribute;

  if (config.target.pageType !== 'entityrecord' || config.target.createNew) {
    if (!attributeChanged) return config;
    return { ...config, context: { ...config.context, source: { kind: 'lookup', attribute } } };
  }

  const destinationChanged = config.target.entityName !== destination;
  const shouldClearForm = attributeChanged || destinationChanged;
  if (!attributeChanged && !destinationChanged && !config.target.formId && !config.target.tabName) return config;

  return {
    ...config,
    context: { ...config.context, source: { kind: 'lookup', attribute } },
    target: {
      ...config.target, entityName: destination,
      ...(shouldClearForm ? { formId: '', tabName: '' } : {}),
      // Form data names columns of the previous table; a first resolution keeps it.
      ...(destinationChanged && config.target.entityName ? { data: '' } : {}),
    },
  };
}
