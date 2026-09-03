// src/components/WidthPicker.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { MIN_CONFIG_WIDTH, MAX_CONFIG_WIDTH } from './previewHelpers';

export interface WidthPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const PRESETS = [320, 400, 480, 600, 800];

export function WidthPicker({
  value,
  onChange,
  min = MIN_CONFIG_WIDTH,
  max = MAX_CONFIG_WIDTH,
  step = 10,
}: WidthPickerProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = +e.target.value;
    if (Number.isNaN(raw)) return;
    onChange(Math.max(min, Math.min(max, Math.round(raw))));
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(+e.target.value)}
          style={{ flex: 1, height: 4, accentColor: T.accent, cursor: 'pointer' }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleNumberChange}
          aria-label="Pane width in pixels"
          style={{
            width: 64,
            padding: '4px 6px',
            border: `1px solid ${T.stroke1}`,
            borderRadius: T.rS,
            background: T.surface1,
            color: T.fg1,
            fontFamily: T.mono,
            fontSize: 12,
            fontWeight: 600,
            textAlign: 'right',
            boxSizing: 'border-box',
            MozAppearance: 'textfield' as React.CSSProperties['MozAppearance'],
          }}
        />
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.fg3, flexShrink: 0 }}>px</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {PRESETS.map(preset => {
          const active = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              style={{
                padding: '3px 10px',
                border: `1px solid ${active ? T.accent : T.stroke1}`,
                borderRadius: 999,
                background: active ? T.accentBg : 'transparent',
                color: active ? T.accent : T.fg2,
                fontFamily: T.mono,
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {preset}
            </button>
          );
        })}
      </div>
    </>
  );
}
