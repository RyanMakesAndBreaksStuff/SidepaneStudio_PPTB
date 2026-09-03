import * as React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { FilteredEntry } from './previewHelpers';

export interface TableComboDropdownProps {
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  filtered: FilteredEntry[];
  query: string;
  highlight: number;
  value: string;
  onCommit: (logicalName: string) => void;
  onHighlight: (idx: number) => void;
  listRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function TableComboDropdown({
  loading,
  error,
  onRetry,
  filtered,
  query,
  highlight,
  value,
  onCommit,
  onHighlight,
  listRef,
}: TableComboDropdownProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  function renderContent() {
    if (loading) {
      return <div style={{ padding: 10, color: T.fg3, fontSize: 12, textAlign: 'center' }}>Loading tables…</div>;
    }
    if (error) {
      return (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ color: T.error, fontSize: 12 }}>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: '3px 10px',
                border: `1px solid ${T.error}`,
                background: 'transparent',
                color: T.error,
                borderRadius: T.rS,
                fontFamily: T.font,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div style={{ padding: 10, color: T.fg3, fontSize: 12, textAlign: 'center' }}>
          {query ? `No tables match "${query}"` : 'No accessible tables found'}
        </div>
      );
    }
    return (
      <div
        ref={listRef}
        role="listbox"
        style={{ maxHeight: 280, overflowY: 'auto' }}
      >
        {filtered.map((entry, idx) => {
          const isHighlighted = idx === highlight;
          const isSelected = entry.table.logicalName === value;
          return (
            <button
              key={entry.table.logicalName}
              type="button"
              role="option"
              data-idx={idx}
              aria-selected={isSelected}
              onMouseEnter={() => onHighlight(idx)}
              onMouseDown={e => {
                e.preventDefault();
                onCommit(entry.table.logicalName);
              }}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                padding: '6px 10px',
                border: 'none',
                background: isHighlighted ? T.accentBg : 'transparent',
                color: T.fg1,
                fontFamily: T.font,
                fontSize: 13,
                textAlign: 'left',
                cursor: 'pointer',
                borderLeft: `2px solid ${isSelected ? T.accent : 'transparent'}`,
              }}
            >
              <span style={{ fontWeight: isSelected ? 600 : 500, color: isSelected ? T.accent : T.fg1 }}>
                {entry.table.displayName}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.fg3 }}>
                {entry.table.logicalName}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      id="tablecombo-listbox"
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        right: 0,
        zIndex: 20,
        background: T.pageBg,
        border: `1px solid ${T.stroke1}`,
        borderRadius: T.rM,
        boxShadow: T.shadow8,
        overflow: 'hidden',
      }}
    >
      {renderContent()}
    </div>
  );
}
