import { describe, expect, it, vi } from 'vitest';
import { MetadataFilterSettingsService } from '../services/MetadataFilterSettingsService';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';

function makeSettings(initial: Record<string, unknown> = {}) {
  return {
    getAll: vi.fn().mockResolvedValue(initial),
    setAll: vi.fn().mockResolvedValue(undefined),
  };
}

describe('MetadataFilterSettingsService', () => {
  it('resolves missing settings to defaults', async () => {
    const settings = makeSettings();
    const service = new MetadataFilterSettingsService(settings);

    await expect(service.load()).resolves.toEqual({
      config: DEFAULT_METADATA_FILTER_CONFIG,
      persistenceAvailable: true,
    });
  });

  it('falls back per list when stored settings are invalid', async () => {
    const settings = makeSettings({
      'metadataFilters.denyPrefixes': ['new_', 'new_'],
      'metadataFilters.denyExact': ['  '],
      'metadataFilters.allowedStandardTables': ['account', 1],
    });
    const service = new MetadataFilterSettingsService(settings);

    const result = await service.load();

    expect(result.config.denyPrefixes).toEqual(['new_']);
    expect(result.config.denyExact).toEqual(DEFAULT_METADATA_FILTER_CONFIG.denyExact);
    expect(result.config.allowedStandardTables).toEqual(
      DEFAULT_METADATA_FILTER_CONFIG.allowedStandardTables
    );
  });

  it('normalizes valid arrays before save and preserves unrelated settings', async () => {
    const settings = makeSettings({ lastConfig: '{"pane":{}}' });
    const service = new MetadataFilterSettingsService(settings);

    const result = await service.save({
      denyPrefixes: [' new_', 'new_'],
      denyExact: [' account '],
      allowedStandardTables: ['contact', 'contact', 'account'],
    });

    expect(result.persistenceAvailable).toBe(true);
    expect(result.config).toEqual({
      denyPrefixes: ['new_'],
      denyExact: ['account'],
      allowedStandardTables: ['contact', 'account'],
    });
    expect(settings.setAll).toHaveBeenCalledWith({
      lastConfig: '{"pane":{}}',
      'metadataFilters.denyPrefixes': ['new_'],
      'metadataFilters.denyExact': ['account'],
      'metadataFilters.allowedStandardTables': ['contact', 'account'],
    });
  });

  it('reset persists defaults without removing unrelated settings', async () => {
    const settings = makeSettings({ lastConfig: '{"pane":{}}' });
    const service = new MetadataFilterSettingsService(settings);

    const result = await service.reset();

    expect(result.config).toEqual(DEFAULT_METADATA_FILTER_CONFIG);
    expect(settings.setAll).toHaveBeenCalledWith({
      lastConfig: '{"pane":{}}',
      'metadataFilters.denyPrefixes': DEFAULT_METADATA_FILTER_CONFIG.denyPrefixes,
      'metadataFilters.denyExact': DEFAULT_METADATA_FILTER_CONFIG.denyExact,
      'metadataFilters.allowedStandardTables': DEFAULT_METADATA_FILTER_CONFIG.allowedStandardTables,
    });
  });

  it('reports persistence unavailable without settings API', async () => {
    const service = new MetadataFilterSettingsService(null);

    await expect(service.load()).resolves.toEqual({
      config: DEFAULT_METADATA_FILTER_CONFIG,
      persistenceAvailable: false,
    });
    await expect(service.reset()).resolves.toEqual({
      config: DEFAULT_METADATA_FILTER_CONFIG,
      persistenceAvailable: false,
    });
  });
});
