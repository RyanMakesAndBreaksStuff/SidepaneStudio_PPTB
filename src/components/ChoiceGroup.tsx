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

export function ChoiceGroup({ name, options, value, onChange }: ChoiceGroupProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {options.map(opt => {
        const sel = value === opt.value;
        const dis = opt.disabled ?? false;
        return (
          <label
            key={opt.value}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 9px',
              border: `1px solid ${sel ? T.accentTeal : T.stroke1}`,
              borderRadius: T.rM,
              background: sel ? T.accentTealBg : T.pageBg,
              cursor: dis ? 'not-allowed' : 'pointer',
              opacity: dis ? 0.5 : 1,
              transition: 'border-color 80ms, background 80ms',
            }}
            onClick={() => { if (!dis) onChange(opt.value); }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={sel}
              onChange={() => { if (!dis) onChange(opt.value); }}
              disabled={dis}
              style={{ display: 'none' }}
            />
            <div style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${sel ? T.accentTeal : T.strokeAcc}`,
              background: sel ? T.accentTeal : 'transparent',
              marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 80ms, background 80ms',
            }}>
              {sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.fg1 }}>
                {opt.label}
                {opt.phase && (
                  <span style={{ fontWeight: 400, fontSize: 10, color: T.fg3, marginLeft: 4 }}>
                    — {opt.phase}
                  </span>
                )}
              </div>
              {opt.desc && <div style={{ fontSize: 11, color: T.fg3 }}>{opt.desc}</div>}
            </div>
          </label>
        );
      })}
    </div>
  );
}
