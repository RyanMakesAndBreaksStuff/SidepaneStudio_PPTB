// src/components/TableComboBox.tsx
// A filterable single-select combobox for Dataverse tables. The parent owns
// table data and load state so the picker stays reusable across metadata callers.
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
  /** Mark the current selection as invalid without replacing available choices. */
  invalid?: boolean;
  onRetry?: () => void;
  placeholder?: string;
  /** Optional aria-label for the input. */
  ariaLabel?: string;
  /** Filter the available table list to custom entities. */
  customOnly?: boolean;
  /** Supply this callback to show the custom-only filter button. */
  onCustomOnlyChange?: (next: boolean) => void;
  /** Disable only the custom-only filter button. */
  filterDisabled?: boolean;
  /** Disable the picker and all of its actions. */
  disabled?: boolean;
}

export function TableComboBox({
  value,
  onChange,
  tables,
  loading,
  error,
  invalid = false,
  onRetry,
  placeholder,
  ariaLabel,
  customOnly = false,
  onCustomOnlyChange,
  filterDisabled = false,
  disabled = false,
}: TableComboBoxProps): React.ReactElement {
  const { isDark } = useTheme();
  const T = theme(isDark);
  const id = React.useId().replace(/:/g, '');
  const listboxId = `${id}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const isOpen = open && !disabled;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Resolve display label for the current value (may not be in `tables` yet during loading).
  const currentTable = useMemo(
    () => tables.find(t => t.logicalName === value),
    [tables, value]
  );
  const displayValue = currentTable
    ? `${currentTable.displayName} (${currentTable.logicalName})`
    : value;
  const customTables = useMemo(
    () => customOnly ? tables.filter(table => table.isCustomEntity === true) : tables,
    [tables, customOnly]
  );
  const filtered = useMemo(() => filterTables(customTables, query), [customTables, query]);

  // Close and clear transient search when the picker becomes unavailable.
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery('');
    }
  }, [disabled]);

  // Reset highlight whenever query, visible choices, or picker visibility changes.
  useEffect(() => { setHighlight(0); }, [query, customOnly, isOpen]);

  // Click-outside closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Scroll the highlighted row into view.
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    item?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight, isOpen]);

  const commit = useCallback((logicalName: string) => {
    onChange(logicalName);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setOpen(true);
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setOpen(true);
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filtered[highlight]) commit(filtered[highlight].table.logicalName);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    } else if (e.key === 'Tab') {
      // Tab commits the highlighted match if filtering, else just closes.
      if (isOpen && query && filtered[highlight]) commit(filtered[highlight].table.logicalName);
      else setOpen(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    height: 32,
    padding: '0 8px',
    border: `1px solid ${error || invalid ? T.error : T.stroke1}`,
    borderRadius: T.rS,
    background: T.surface1,
    boxShadow: isOpen && !error && !invalid ? `inset 0 -2px ${T.accent}` : 'none',
    fontFamily: T.font,
    fontSize: 13,
    boxSizing: 'border-box',
    cursor: loading ? 'wait' : disabled ? 'default' : 'text',
    transition: 'box-shadow 80ms',
  };
  const filterUnavailable = filterDisabled || disabled || loading || Boolean(error);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={fieldStyle}
        onClick={() => {
          if (!loading && !disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.fg3} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="6.75" cy="6.75" r="4.25" />
          <path d="m10 10 3.25 3.25" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : displayValue}
          placeholder={value ? '' : (placeholder ?? 'Select a table…')}
          onChange={e => { setOpen(true); setQuery(e.target.value); }}
          onFocus={() => { if (!disabled) setOpen(true); }}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          aria-invalid={Boolean(error || invalid) || undefined}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={isOpen && filtered[highlight] ? `${id}-option-${highlight}` : undefined}
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
          disabled={loading || disabled}
        />
        {onCustomOnlyChange && (
          <button
            type="button"
            aria-label="Show custom tables only"
            aria-pressed={customOnly}
            disabled={filterUnavailable}
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              onCustomOnlyChange(!customOnly);
              setOpen(true);
              setHighlight(0);
            }}
            title={customOnly ? 'Show all tables' : 'Show custom tables only'}
            style={{
              width: 24,
              height: 24,
              flex: '0 0 24px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: 'none',
              borderRadius: T.rS,
              background: customOnly ? T.accentBg : 'transparent',
              color: customOnly ? T.accent : T.fg3,
              cursor: filterUnavailable ? 'default' : 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 3.25h11l-4.25 4.5v4l-2.5 1v-5z" />
            </svg>
          </button>
        )}
        {(Boolean(value) || (open && Boolean(query))) && !disabled && !loading && (
          <button
            type="button"
            aria-label="Clear selection"
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(true);
              inputRef.current?.focus();
            }}
            title="Clear"
            style={{
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: T.fg3,
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
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
      {isOpen && (
        <TableComboDropdown
          id={listboxId}
          optionIdPrefix={`${id}-option`}
          loading={loading}
          error={error}
          onRetry={onRetry}
          filtered={filtered}
          query={query}
          customOnly={customOnly}
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
