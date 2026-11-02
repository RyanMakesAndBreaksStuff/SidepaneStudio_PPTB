import * as React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { theme } from '../../theme/tokens';
import type { PaneDefinitionConfig } from '../../types/PaneDefinitionConfig';
import type { ValidationResult } from '../../services/ValidationService';
import { describeConfig, type SummarySlot } from '../../services/describeConfig';

export interface SentenceSummaryProps {
  config: PaneDefinitionConfig;
  validation: ValidationResult;
  onJump: (slot: SummarySlot) => void;
}

export function SentenceSummary({ config, validation, onJump }: SentenceSummaryProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const parts = describeConfig(config);
  const errors = validation.errors.length;
  const warnings = validation.warnings.length;
  return (
    <div role="region" aria-label="Configuration summary"
      style={{ position: 'sticky', top: 0, zIndex: 1, padding: '10px 14px', background: T.surface2,
        borderBottom: `1px solid ${T.stroke1}`, fontFamily: T.font, fontSize: 13, lineHeight: 1.9, color: T.fg1 }}>
      {parts.map((part, index) => part.slot ? (
        <React.Fragment key={index}>
          {part.text.startsWith(' ') && <span> </span>}
          <button type="button" data-slot={part.slot} onClick={() => onJump(part.slot!)}
            style={{ font: 'inherit', fontWeight: 600, color: T.fg1, background: T.accentBg,
              border: 'none', borderBottom: `2px solid ${T.accent}`, borderRadius: `${T.rS} ${T.rS} 0 0`,
              padding: '0 3px', margin: '0 1px', cursor: 'pointer' }}>
            {part.text.trimStart()}
          </button>
        </React.Fragment>
      ) : <span key={index}>{part.text}</span>)}
      <div role="status" style={{ fontSize: 11, color: errors ? T.error : T.fg3, marginTop: 2 }}>
        {errors} error{errors === 1 ? '' : 's'} · {warnings} warning{warnings === 1 ? '' : 's'}
      </div>
    </div>
  );
}
