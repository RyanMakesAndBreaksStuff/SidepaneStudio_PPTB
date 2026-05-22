// src/components/TableComboBox.tsx
// A filterable single-select combobox for Dataverse tables. Presentational —
// the parent owns the table list + load state, so this component can be reused
// against any MetadataService caller without coupling.
import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import { TableInfo } from '../services/MetadataService';

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

interface FilteredEntry {
  table: TableInfo;
  matchedOn: 'display' | 'logical' | 'both';
}

function filterTables(tables: TableInfo[], query: string): FilteredEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return tables.map(t => ({ table: t, matchedOn: 'display' as const }));
  }
  const out: FilteredEntry[] = [];
  for (const t of tables) {
    const inDisplay = t.displayName.toLowerCase().includes(q);
    const inLogical = t.logicalName.toLowerCase().includes(q);
    if (!inDisplay && !inLogical) continue;
    out.push({
      table: t,
      matchedOn: inDisplay && inLogical ? 'both' : inDisplay ? 'display' : 'logical',
    });
  }
  // Prefix matches first (more relevant), then alpha
  out.sort((a, b) => {
    const ap = a.table.displayName.toLowerCase().startsWith(q) || a.table.logicalName.toLowerCase().startsWith(q);
    const bp = b.table.displayName.toLowerCase().startsWith(q) || b.table.logicalName.toLowerCase().startsWith(q);
    if (ap !== bp) return ap ? -1 : 1;
    return a.table.displayName.localeCompare(b.table.displayName);
  });
  return out;
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

  const renderPanelContent = () => {
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
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={e => {
                // Prevent input blur before click registers
                e.preventDefault();
                commit(entry.table.logicalName);
              }}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                padding: '6px 10px',
                border: 'none',
                background: isHighlighted ? T.accentTealBg : 'transparent',
                color: T.fg1,
                fontFamily: T.font,
                fontSize: 13,
                textAlign: 'left',
                cursor: 'pointer',
                borderLeft: `2px solid ${isSelected ? T.accentTeal : 'transparent'}`,
              }}
            >
              <span style={{ fontWeight: isSelected ? 600 : 500, color: isSelected ? T.accentTeal : T.fg1 }}>
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
          {renderPanelContent()}
        </div>
      )}
    </div>
  );
}
