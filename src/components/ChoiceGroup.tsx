// src/components/ChoiceGroup.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface ChoiceGroupOption {
  value: string;
  label: string;
  desc?: string;
  disabled?: boolean;
}

export interface ChoiceGroupProps {
  /** Accessible name of the group; pass the visible field label. */
  label: string;
  options: ChoiceGroupOption[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Pill-style single-select. Wraps to multiple rows, highlights the active
 * choice with the accent color, and surfaces `desc` of the selected option
 * below the pill row so descriptions stay visible without bloating each pill.
 * `disabled` greys the pill + blocks selection. Keyboard follows the ARIA radio
 * group: one Tab stop, arrow keys move focus and selection.
 */
export function ChoiceGroup({ label, options, value, onChange }: ChoiceGroupProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  const selected = options.find(o => o.value === value);
  const enabled = options.filter(o => !o.disabled);
  const tabStop = enabled.some(o => o.value === value) ? value : enabled[0]?.value;
  // Re-choosing the current pill must not reach the caller, whose handler resets dependent fields.
  const choose = (next: string) => { if (next !== value) onChange(next); };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: string) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step || enabled.length === 0) return;
    event.preventDefault();
    const at = enabled.findIndex(o => o.value === current);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[options.indexOf(next)]?.focus();
    choose(next.value);
  };

  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              tabIndex={opt.value === tabStop ? 0 : -1}
              title={opt.desc}
              onClick={() => { if (!dis) choose(opt.value); }}
              onKeyDown={event => handleKeyDown(event, opt.value)}
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
            </button>
          );
        })}
      </div>
      {selected?.desc && (
        <div
          style={{
            fontSize: 11,
            color: T.fg2,
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
