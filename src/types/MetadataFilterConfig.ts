export interface MetadataFilterConfig {
  denyPrefixes: string[];
  denyExact: string[];
  allowedStandardTables: string[];
}

export const DEFAULT_METADATA_FILTER_CONFIG: MetadataFilterConfig = {
  denyPrefixes: [
    'adx_', 'cdm_', 'msdyn_', 'mspp_', 'workflow', 'process',
    'sdkmessage', 'solution', 'appmodule', 'ribbon', 'dependency',
    'component', 'duplicaterule',
  ],
  denyExact: [
    'systemuser', 'team', 'businessunit', 'role', 'privilege', 'organization',
    'publisher', 'solution', 'savedquery', 'userquery', 'systemform', 'appmodule',
    'sitemap', 'webresource', 'pluginassembly', 'plugintype', 'sdkmessageprocessingstep',
    'environmentvariabledefinition', 'environmentvariablevalue',
  ],
  allowedStandardTables: [
    'account', 'contact', 'lead', 'opportunity', 'incident', 'quote',
    'salesorder', 'invoice', 'task', 'phonecall', 'appointment', 'email',
  ],
};

export const METADATA_FILTER_CONFIG_KEYS = [
  'denyPrefixes',
  'denyExact',
  'allowedStandardTables',
] as const;

export type MetadataFilterConfigKey = typeof METADATA_FILTER_CONFIG_KEYS[number];

export function normalizeMetadataFilterList(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

export function normalizeMetadataFilterConfig(config: MetadataFilterConfig): MetadataFilterConfig {
  return {
    denyPrefixes: normalizeMetadataFilterList(config.denyPrefixes),
    denyExact: normalizeMetadataFilterList(config.denyExact),
    allowedStandardTables: normalizeMetadataFilterList(config.allowedStandardTables),
  };
}

export function resolveMetadataFilterList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  if (value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
    return fallback;
  }
  return normalizeMetadataFilterList(value);
}

export function resolveMetadataFilterConfig(values: Record<string, unknown>): MetadataFilterConfig {
  return {
    denyPrefixes: resolveMetadataFilterList(values.denyPrefixes, DEFAULT_METADATA_FILTER_CONFIG.denyPrefixes),
    denyExact: resolveMetadataFilterList(values.denyExact, DEFAULT_METADATA_FILTER_CONFIG.denyExact),
    allowedStandardTables: resolveMetadataFilterList(
      values.allowedStandardTables,
      DEFAULT_METADATA_FILTER_CONFIG.allowedStandardTables
    ),
  };
}
