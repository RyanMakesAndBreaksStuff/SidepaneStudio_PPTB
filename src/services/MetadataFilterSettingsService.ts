import {
  DEFAULT_METADATA_FILTER_CONFIG,
  MetadataFilterConfig,
  normalizeMetadataFilterConfig,
  resolveMetadataFilterConfig,
} from '../types/MetadataFilterConfig';

export interface MetadataFilterSettingsAPI {
  getAll: () => Promise<Record<string, unknown>>;
  set: (key: string, value: unknown) => Promise<void>;
}

export interface MetadataFilterSettingsResult {
  config: MetadataFilterConfig;
  persistenceAvailable: boolean;
}

/** One key holds the whole config, so a save or reset is a single write that cannot half-land. */
const SETTING_KEY = 'metadataFilters';
/** Written by versions that stored one key per list; read only while SETTING_KEY has never been written. */
const LEGACY_SETTING_KEYS = {
  denyPrefixes: 'metadataFilters.denyPrefixes',
  denyExact: 'metadataFilters.denyExact',
  allowedStandardTables: 'metadataFilters.allowedStandardTables',
} as const;

function pickMetadataFilterSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const stored = settings[SETTING_KEY];
  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) return stored as Record<string, unknown>;
  return {
    denyPrefixes: settings[LEGACY_SETTING_KEYS.denyPrefixes],
    denyExact: settings[LEGACY_SETTING_KEYS.denyExact],
    allowedStandardTables: settings[LEGACY_SETTING_KEYS.allowedStandardTables],
  };
}

export class MetadataFilterSettingsService {
  constructor(private readonly settings?: MetadataFilterSettingsAPI | null) {}

  get persistenceAvailable(): boolean {
    return !!this.settings;
  }

  async load(): Promise<MetadataFilterSettingsResult> {
    if (!this.settings) {
      return { config: DEFAULT_METADATA_FILTER_CONFIG, persistenceAvailable: false };
    }

    const allSettings = await this.settings.getAll();
    return {
      config: resolveMetadataFilterConfig(pickMetadataFilterSettings(allSettings)),
      persistenceAvailable: true,
    };
  }

  async save(config: MetadataFilterConfig): Promise<MetadataFilterSettingsResult> {
    const normalized = normalizeMetadataFilterConfig(config);
    if (!this.settings) {
      return { config: normalized, persistenceAvailable: false };
    }

    await this.settings.set(SETTING_KEY, normalized);
    return { config: normalized, persistenceAvailable: true };
  }

  async reset(): Promise<MetadataFilterSettingsResult> {
    if (!this.settings) {
      return { config: DEFAULT_METADATA_FILTER_CONFIG, persistenceAvailable: false };
    }

    await this.settings.set(SETTING_KEY, DEFAULT_METADATA_FILTER_CONFIG);
    return { config: DEFAULT_METADATA_FILTER_CONFIG, persistenceAvailable: true };
  }
}
