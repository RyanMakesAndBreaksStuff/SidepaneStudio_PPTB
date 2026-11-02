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

const SETTING_KEYS = {
  denyPrefixes: 'metadataFilters.denyPrefixes',
  denyExact: 'metadataFilters.denyExact',
  allowedStandardTables: 'metadataFilters.allowedStandardTables',
} as const;

function pickMetadataFilterSettings(settings: Record<string, unknown>): Record<string, unknown> {
  return {
    denyPrefixes: settings[SETTING_KEYS.denyPrefixes],
    denyExact: settings[SETTING_KEYS.denyExact],
    allowedStandardTables: settings[SETTING_KEYS.allowedStandardTables],
  };
}

function toSettings(config: MetadataFilterConfig): Record<string, unknown> {
  return {
    [SETTING_KEYS.denyPrefixes]: config.denyPrefixes,
    [SETTING_KEYS.denyExact]: config.denyExact,
    [SETTING_KEYS.allowedStandardTables]: config.allowedStandardTables,
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

    await this.writeConfig(this.settings, normalized);
    return { config: normalized, persistenceAvailable: true };
  }

  async reset(): Promise<MetadataFilterSettingsResult> {
    if (!this.settings) {
      return { config: DEFAULT_METADATA_FILTER_CONFIG, persistenceAvailable: false };
    }

    await this.writeConfig(this.settings, DEFAULT_METADATA_FILTER_CONFIG);
    return { config: DEFAULT_METADATA_FILTER_CONFIG, persistenceAvailable: true };
  }

  // Per-key writes: a getAll/setAll read-modify-write could clobber a concurrent 'lastConfig' write.
  private async writeConfig(settings: MetadataFilterSettingsAPI, config: MetadataFilterConfig): Promise<void> {
    for (const [key, value] of Object.entries(toSettings(config))) {
      await settings.set(key, value);
    }
  }
}
