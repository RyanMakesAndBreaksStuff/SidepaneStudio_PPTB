import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../theme/tokens';
import {
  MetadataFilterConfig,
  MetadataFilterConfigKey,
  METADATA_FILTER_CONFIG_KEYS,
  normalizeMetadataFilterConfig,
} from '../../types/MetadataFilterConfig';
import { Callout } from '../Callout';
import { Field } from '../Field';

export interface MetadataFilterConfigEditorProps {
  config: MetadataFilterConfig;
  defaultConfig: MetadataFilterConfig;
  persistenceAvailable: boolean;
  onSave: (config: MetadataFilterConfig) => Promise<void> | void;
  onReset: () => Promise<void> | void;
  error?: string | null;
}

const LABELS: Record<MetadataFilterConfigKey, string> = {
  denyPrefixes: 'Deny prefixes',
  denyExact: 'Deny exact table names',
  allowedStandardTables: 'Allowed standard tables',
};

const HELPERS: Record<MetadataFilterConfigKey, string> = {
  denyPrefixes: 'JSON array of table-name prefixes to exclude from picker metadata.',
  denyExact: 'JSON array of exact logical table names to hide from picker metadata.',
  allowedStandardTables: 'JSON array of standard table names to keep available in picker metadata.',
};

const ERROR_COPY = 'Enter a valid JSON array of strings, for example ["account", "contact"].';

function formatList(values: string[]): string {
  return JSON.stringify(values, null, 2);
}

function formatConfig(config: MetadataFilterConfig): Record<MetadataFilterConfigKey, string> {
  return {
    denyPrefixes: formatList(config.denyPrefixes),
    denyExact: formatList(config.denyExact),
    allowedStandardTables: formatList(config.allowedStandardTables),
  };
}

function parseList(text: string): { value?: string[]; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: ERROR_COPY };
  }

  if (!Array.isArray(parsed)) return { error: ERROR_COPY };
  if (parsed.some(item => typeof item !== 'string' || item.trim().length === 0)) {
    return { error: ERROR_COPY };
  }

  return { value: parsed };
}

function parseConfig(
  texts: Record<MetadataFilterConfigKey, string>
): { config?: MetadataFilterConfig; errors: Partial<Record<MetadataFilterConfigKey, string>> } {
  const errors: Partial<Record<MetadataFilterConfigKey, string>> = {};
  const next: MetadataFilterConfig = {
    denyPrefixes: [],
    denyExact: [],
    allowedStandardTables: [],
  };

  for (const key of METADATA_FILTER_CONFIG_KEYS) {
    const result = parseList(texts[key]);
    if (result.error) {
      errors[key] = result.error;
    } else {
      next[key] = result.value ?? [];
    }
  }

  return Object.keys(errors).length > 0
    ? { errors }
    : { config: normalizeMetadataFilterConfig(next), errors };
}

export function MetadataFilterConfigEditor({
  config,
  defaultConfig,
  persistenceAvailable,
  onSave,
  onReset,
  error,
}: MetadataFilterConfigEditorProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const cleanTexts = useMemo(() => formatConfig(config), [config]);
  const [texts, setTexts] = useState<Record<MetadataFilterConfigKey, string>>(cleanTexts);
  const [errors, setErrors] = useState<Partial<Record<MetadataFilterConfigKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setTexts(cleanTexts);
    setErrors({});
  }, [cleanTexts]);

  const dirty = METADATA_FILTER_CONFIG_KEYS.some(key => texts[key] !== cleanTexts[key]);

  const updateText = (key: MetadataFilterConfigKey, value: string) => {
    setTexts(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    const parsed = parseConfig(texts);
    setErrors(parsed.errors);
    if (!parsed.config) return;
    setSaving(true);
    try {
      await onSave(parsed.config);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setTexts(formatConfig(defaultConfig));
    setErrors({});
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!persistenceAvailable && (
        <Callout type="info" icon="i">
          PPTB settings unavailable. Save is disabled in local browser mode.
        </Callout>
      )}
      {error && <Callout type="err" icon="!">{error}</Callout>}

      {METADATA_FILTER_CONFIG_KEYS.map(key => (
        <Field key={key} label={LABELS[key]} error={errors[key]}>
          <div style={{ color: T.fg2, fontFamily: T.font, fontSize: 11, lineHeight: 1.35 }}>
            {HELPERS[key]}
          </div>
          <textarea
            aria-label={LABELS[key]}
            value={texts[key]}
            onChange={event => updateText(key, event.currentTarget.value)}
            spellCheck={false}
            style={{
              minHeight: 86,
              width: '100%',
              resize: 'vertical',
              boxSizing: 'border-box',
              border: `1px solid ${errors[key] ? T.error : T.stroke1}`,
              borderRadius: T.rM,
              background: T.surface2,
              color: T.fg1,
              fontFamily: "'Consolas', 'Cascadia Code', monospace",
              fontSize: 12,
              lineHeight: 1.35,
              padding: '8px 9px',
              outline: 'none',
            }}
          />
        </Field>
      ))}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={!persistenceAvailable || saving}
            style={{
              border: 'none',
              borderRadius: T.rM,
              background: persistenceAvailable ? T.accentTeal : T.surface3,
              color: persistenceAvailable ? '#001818' : T.fg3,
              cursor: persistenceAvailable ? 'pointer' : 'not-allowed',
              fontFamily: T.font,
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 10px',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          disabled={resetting}
          style={{
            border: `1px solid ${T.stroke1}`,
            borderRadius: T.rM,
            background: T.surface2,
            color: T.fg1,
            cursor: resetting ? 'wait' : 'pointer',
            fontFamily: T.font,
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 10px',
          }}
        >
          {resetting ? 'Resetting...' : 'Reset to defaults'}
        </button>
      </div>
    </div>
  );
}
