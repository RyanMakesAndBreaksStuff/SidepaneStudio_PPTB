// src/components/TableComboBox.tsx
// A filterable single-select combobox for Dataverse tables. Presentational —
// the parent owns the table list + load state, so this component can be reused
// against any MetadataService caller without coupling.
import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { TableInfo } from '../services/MetadataService';
import { filterTables } from './previewHelpers';
import { TableComboDropdown } from './TableComboDropdown';

export interface TableComboBoxProps {
  /** Selected table logical name (or '' for none). */
  value: string;
  onChange: (logicalName: string) => void;
  /** Full table list — pass [] while loading. */
  tables: TableInfo[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  placeholder?: string;
  /** Optional aria-label for the input. */
  ariaLabel?: string;
}

export function TableComboBox({
  value,
  onChange,
  tables,
  loading,
  error,
  onRetry,
  placeholder,
  ariaLabel,
}: TableComboBoxProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Resolve display label for the current value (may not be in `tables` yet during loading)
  const currentTable = useMemo(
    () => tables.find(t => t.logicalName === value),
    [tables, value]
  );
  const displayValue = currentTable
    ? `${currentTable.displayName} (${currentTable.logicalName})`
    : value;

  const filtered = useMemo(() => filterTables(tables, query), [tables, query]);

  // Reset highlight when the filtered list changes
  useEffect(() => { setHighlight(0); }, [query, open]);

  // Click-outside closes the panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll the highlighted row into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const commit = useCallback((logicalName: string) => {
    onChange(logicalName);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) commit(filtered[highlight].table.logicalName);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    } else if (e.key === 'Tab') {
      // Tab commits the highlighted match if filtering, else just closes
      if (open && query && filtered[highlight]) commit(filtered[highlight].table.logicalName);
      else setOpen(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: '4px 8px',
    border: `1px solid ${error ? T.error : (open ? T.accentTeal : T.stroke1)}`,
    borderRadius: T.rS,
    background: T.surface1,
    fontFamily: T.font,
    fontSize: 13,
    boxSizing: 'border-box',
    cursor: loading ? 'wait' : 'text',
    transition: 'border-color 80ms',
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={fieldStyle}
        onClick={() => {
          if (!loading) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : displayValue}
          placeholder={value ? '' : (placeholder ?? 'Select a table…')}
          onChange={e => { setOpen(true); setQuery(e.target.value); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="tablecombo-listbox"
          role="combobox"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: value || open ? T.fg1 : T.fg3,
            fontFamily: T.font,
            fontSize: 13,
            outline: 'none',
            padding: 0,
            minWidth: 0,
          }}
          disabled={loading}
        />
        {value && !loading && (
          <button
            type="button"
            aria-label="Clear selection"
            onMouseDown={e => { e.preventDefault(); onChange(''); setQuery(''); inputRef.current?.focus(); }}
            title="Clear"
            style={{
              border: 'none',
              background: 'transparent',
              color: T.fg3,
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          stroke={T.fg3}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
      {open && (
        <TableComboDropdown
          loading={loading}
          error={error}
          onRetry={onRetry}
          filtered={filtered}
          query={query}
          highlight={highlight}
          value={value}
          onCommit={commit}
          onHighlight={setHighlight}
          listRef={listRef}
        />
      )}
    </div>
  );
}
