// src/components/ChoiceGroup.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface ChoiceGroupOption {
  value: string;
  label: string;
  desc?: string;
  phase?: string;
  disabled?: boolean;
}

export interface ChoiceGroupProps {
  name: string;
  options: ChoiceGroupOption[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Pill-style single-select. Wraps to multiple rows, highlights the active
 * choice with the accent color, and surfaces `desc` of the selected option
 * below the pill row so descriptions stay visible without bloating each pill.
 * `phase` renders as a small inline subscript (e.g. "Dashboard · Soon") and
 * `disabled` greys the pill + blocks selection.
 */
export function ChoiceGroup({ name, options, value, onChange }: ChoiceGroupProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  const selected = options.find(o => o.value === value);

  return (
    <div role="radiogroup" aria-label={name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(opt => {
          const sel = value === opt.value;
          const dis = opt.disabled ?? false;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={sel}
              aria-disabled={dis || undefined}
              disabled={dis}
              title={opt.desc}
              onClick={() => { if (!dis) onChange(opt.value); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                border: `1px solid ${sel ? T.accent : T.stroke1}`,
                borderRadius: T.rFull,
                background: sel ? T.accentBg : 'transparent',
                color: sel ? T.accent : (dis ? T.fg3 : T.fg1),
                fontFamily: T.font,
                fontSize: 12,
                fontWeight: sel ? 600 : 500,
                cursor: dis ? 'not-allowed' : 'pointer',
                opacity: dis ? 0.55 : 1,
                whiteSpace: 'nowrap',
                transition: 'border-color 80ms, background 80ms, color 80ms',
              }}
            >
              {sel && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: T.accent,
                    flexShrink: 0,
                  }}
                />
              )}
              <span>{opt.label}</span>
              {opt.phase && (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10,
                    fontWeight: 500,
                    color: T.fg3,
                    paddingLeft: 6,
                    borderLeft: `1px solid ${T.stroke1}`,
                    marginLeft: 2,
                    textTransform: 'uppercase',
                    letterSpacing: '.4px',
                  }}
                >
                  {opt.phase}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected?.desc && (
        <div
          style={{
            fontSize: 11,
            color: T.fg3,
            lineHeight: 1.45,
            paddingLeft: 2,
          }}
        >
          {selected.desc}
        </div>
      )}
    </div>
  );
}
