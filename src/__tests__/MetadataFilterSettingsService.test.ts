import { describe, expect, it, vi } from 'vitest';
import { MetadataFilterSettingsService } from '../services/MetadataFilterSettingsService';
import { DEFAULT_METADATA_FILTER_CONFIG } from '../types/MetadataFilterConfig';

function makeSettings(initial: Record<string, unknown> = {}) {
  return {
    getAll: vi.fn().mockResolvedValue(initial),
    set: vi.fn().mockResolvedValue(undefined),
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

  it('reads the single metadataFilters key and ignores the legacy keys once it exists', async () => {
    const settings = makeSettings({
      metadataFilters: { denyPrefixes: ['abc_'], denyExact: ['webresource'], allowedStandardTables: ['account'] },
      'metadataFilters.denyPrefixes': ['legacy_'],
      'metadataFilters.denyExact': ['legacy'],
      'metadataFilters.allowedStandardTables': ['legacy'],
    });

    const result = await new MetadataFilterSettingsService(settings).load();

    expect(result.config).toEqual({ denyPrefixes: ['abc_'], denyExact: ['webresource'], allowedStandardTables: ['account'] });
  });

  it('falls back per list inside the single key, not to the legacy keys', async () => {
    const settings = makeSettings({
      metadataFilters: { denyPrefixes: ['abc_'], denyExact: 'oops' },
      'metadataFilters.denyExact': ['legacy'],
    });

    const result = await new MetadataFilterSettingsService(settings).load();

    expect(result.config.denyPrefixes).toEqual(['abc_']);
    expect(result.config.denyExact).toEqual(DEFAULT_METADATA_FILTER_CONFIG.denyExact);
    expect(result.config.allowedStandardTables).toEqual(DEFAULT_METADATA_FILTER_CONFIG.allowedStandardTables);
  });

  it('falls back to the three legacy keys when metadataFilters was never written', async () => {
    const settings = makeSettings({
      metadataFilters: 'not an object',
      'metadataFilters.denyPrefixes': ['legacy_'],
      'metadataFilters.denyExact': ['legacy'],
      'metadataFilters.allowedStandardTables': ['contact'],
    });

    const result = await new MetadataFilterSettingsService(settings).load();

    expect(result.config).toEqual({ denyPrefixes: ['legacy_'], denyExact: ['legacy'], allowedStandardTables: ['contact'] });
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

  it('normalizes valid arrays before save and never writes unrelated settings', async () => {
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
    expect(settings.set).toHaveBeenCalledTimes(1);
    expect(settings.set).toHaveBeenCalledWith('metadataFilters', {
      denyPrefixes: ['new_'],
      denyExact: ['account'],
      allowedStandardTables: ['contact', 'account'],
    });
    expect(settings.set).not.toHaveBeenCalledWith('lastConfig', expect.anything());
    expect(settings.setAll).not.toHaveBeenCalled();
  });

  it('reset persists defaults without touching unrelated settings', async () => {
    const settings = makeSettings({ lastConfig: '{"pane":{}}' });
    const service = new MetadataFilterSettingsService(settings);

    const result = await service.reset();

    expect(result.config).toEqual(DEFAULT_METADATA_FILTER_CONFIG);
    expect(settings.set).toHaveBeenCalledTimes(1);
    expect(settings.set).toHaveBeenCalledWith('metadataFilters', DEFAULT_METADATA_FILTER_CONFIG);
    expect(settings.set).not.toHaveBeenCalledWith('lastConfig', expect.anything());
    expect(settings.setAll).not.toHaveBeenCalled();
  });

  /** A store that accepts one write and rejects every later one, so a multi-key save would leave a partial config. */
  function makeFailingAfterFirstWrite() {
    const persisted: Record<string, unknown> = {};
    const settings = makeSettings();
    settings.set.mockImplementation(async (key: string, value: unknown) => {
      if (Object.keys(persisted).length > 0) throw new Error('settings backend offline');
      persisted[key] = value;
    });
    return { settings, persisted };
  }

  it('saves the whole config in one write, so a store that fails later writes cannot leave it half-saved', async () => {
    const { settings, persisted } = makeFailingAfterFirstWrite();
    const config = { denyPrefixes: ['abc_'], denyExact: ['webresource'], allowedStandardTables: ['account'] };

    await expect(new MetadataFilterSettingsService(settings).save(config)).resolves.toMatchObject({ config });

    expect(persisted).toEqual({ metadataFilters: config });
  });

  it('resets the whole config in one write, so a store that fails later writes cannot leave it half-reset', async () => {
    const { settings, persisted } = makeFailingAfterFirstWrite();

    await expect(new MetadataFilterSettingsService(settings).reset()).resolves.toMatchObject({ config: DEFAULT_METADATA_FILTER_CONFIG });

    expect(persisted).toEqual({ metadataFilters: DEFAULT_METADATA_FILTER_CONFIG });
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
