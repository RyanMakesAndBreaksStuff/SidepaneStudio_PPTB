// src/components/SummaryCard.tsx
import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';

export interface SummaryCardProps {
  title: string;
  body?: string;
  steps?: string[];
}

export function SummaryCard({ title, body, steps }: SummaryCardProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  return (
    <div style={{
      background: T.infoBg, border: `1px solid ${T.info}`,
      borderRadius: T.rM, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.info }}>{title}</div>
      {body && (
        <div
          style={{ fontSize: 12, color: T.info, lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}
      {steps && steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: T.info }}>
              <span style={{ fontWeight: 700, minWidth: 16 }}>{i + 1}.</span>
              <span dangerouslySetInnerHTML={{ __html: s }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
