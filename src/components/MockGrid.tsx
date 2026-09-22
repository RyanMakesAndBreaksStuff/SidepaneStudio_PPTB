import * as React from 'react';
import { FL } from './flTokens';
import type { GridColumn } from '../services/GridViewModel';
import { gridCellText } from '../services/GridViewModel';

const glyphs = {
  back: 'M13 3L6 10l7 7M6 10h13',
  add: 'M10 2v16M2 10h16',
  delete: 'M3 5h14M7 5V2h6v3M5 5l1 13h8l1-13M8 8v7M12 8v7',
  chart: 'M3 17V9h3v8M9 17V3h3v14M15 17v-6h3v6',
  refresh: 'M17 7A7 7 0 1 0 17 13M17 2v5h-5',
  email: 'M2 5h16v12H2zM2 5l8 6 8-6',
  flow: 'M3 3h8l6 7-6 7H3l6-7z',
  report: 'M3 3h14v14H3zM6 13V9M10 13V6M14 13v-3',
  more: 'M10 4h.01M10 10h.01M10 16h.01',
  share: 'M12 3l5 4-5 4M17 7H8v7M5 6H2v12h14v-4',
  columns: 'M2 3h16v14H2zM2 7h16M7 7v10M13 7v10',
  filter: 'M2 3h16l-6 7v7l-4-2v-5z',
  search: 'M13 13l5 5M15 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
} as const;
function GridIcon({ name }: { name: keyof typeof glyphs }): React.ReactElement {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none"
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d={glyphs[name]} />
  </svg>;
}

export function MockGrid({ rows, columns, viewName, selectedRows, activeRow, onSelectionChange, onCommand, onRefresh }: {
  rows: Record<string, unknown>[];
  columns: GridColumn[];
  viewName: string;
  selectedRows: number[];
  activeRow: number | null;
  onSelectionChange: (indices: number[]) => void;
  onCommand: () => void;
  onRefresh: () => void;
}): React.ReactElement {
  const all = rows.length > 0 && selectedRows.length === rows.length;
  const some = selectedRows.length > 0 && !all;
  const cellStyle: React.CSSProperties = { height: 40, padding: '0 12px', borderBottom: `1px solid ${FL.stroke}`,
    textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 400 };
  const buttonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, height: 36,
    border: 0, borderRadius: 4, background: 'transparent', color: FL.fg, font: 'inherit', padding: '0 10px',
    whiteSpace: 'nowrap', flexShrink: 0 };
  const commands: { label: string; icon: keyof typeof glyphs; dropdown?: boolean }[] = [
    { label: 'Back', icon: 'back' }, { label: 'New', icon: 'add' }, { label: 'Delete', icon: 'delete' },
    { label: 'Show chart', icon: 'chart' }, { label: 'Refresh', icon: 'refresh' },
    { label: 'Visualize this view', icon: 'chart' }, { label: 'Email a Link', icon: 'email' },
    { label: 'Flow', icon: 'flow', dropdown: true }, { label: 'Run Report', icon: 'report', dropdown: true },
    { label: 'More commands', icon: 'more' }, { label: 'Share', icon: 'share', dropdown: true },
  ];
  return <section aria-label="Grid preview" style={{ background: FL.appBg, color: FL.fg,
    minWidth: 0, fontFamily: FL.font, fontSize: 13, paddingTop: 8 }}>
    <div role="toolbar" aria-label="Grid commands" style={{ display: 'flex', alignItems: 'center', gap: 2,
      overflowX: 'auto', background: FL.surface, borderRadius: 8, boxShadow: FL.shadow, padding: 4, marginBottom: 8 }}>
      {commands.map(({ label, icon, dropdown }) => <button key={label} type="button" aria-label={label}
        disabled={label !== 'Refresh'} onClick={label === 'Refresh' ? onRefresh : undefined}
        title={label === 'Refresh' ? 'Reload preview rows' : `${label} (preview only)`}
        style={{ ...buttonStyle, marginLeft: label === 'Share' ? 'auto' : undefined }}>
        <GridIcon name={icon} />
        {!['Back', 'Show chart', 'More commands'].includes(label) && label}
        {dropdown && <span aria-hidden="true">⌄</span>}
      </button>)}
      <button type="button" style={buttonStyle} disabled={selectedRows.length !== 1} onClick={onCommand}>Preview command</button>
    </div>
    <div style={{ background: FL.surface, borderRadius: 8, boxShadow: FL.shadow, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 16px' }}>
        <strong style={{ fontSize: 18, fontWeight: 600, marginRight: 'auto' }}>{viewName} <span aria-hidden="true">⌄</span></strong>
        <button type="button" disabled style={buttonStyle}><GridIcon name="columns" />Edit columns</button>
        <button type="button" disabled style={buttonStyle}><GridIcon name="filter" />Edit filters</button>
        <label style={{ display: 'flex', alignItems: 'center', border: `1px solid ${FL.strokeStrong}`, padding: '4px 8px' }}>
          <GridIcon name="search" /><input aria-label="Search this view (preview only)" disabled
            style={{ border: 0, width: 120, background: 'transparent' }} />
        </label>
      </div>
      {activeRow !== null && <p role="status" style={{ padding: '0 16px' }}>
        SelectedRow: row {activeRow + 1} — {gridCellText(rows[activeRow], columns.find(c => c.primary) ?? columns[0])} (simulation)
      </p>}
      <div style={{ overflow: 'auto', maxHeight: 480, margin: '0 16px' }}>
        <table aria-label={viewName} style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed',
          minWidth: 44 + columns.reduce((width, column) => width + column.width, 0) }}>
          <colgroup><col style={{ width: 44 }} />{columns.map(c => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
          <thead><tr>
            <th scope="col" style={{ ...cellStyle, width: 44 }}><input type="checkbox" aria-label="Select all preview rows"
              checked={all} disabled={!rows.length} ref={node => { if (node) node.indeterminate = some; }}
              onChange={e => onSelectionChange(e.target.checked ? rows.map((_, i) => i) : [])} /></th>
            {columns.map(column => <th scope="col" key={column.key} style={{ ...cellStyle, width: column.width }}>{column.label}</th>)}
          </tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} aria-selected={selectedRows.includes(index)}
            style={{ background: selectedRows.includes(index) ? FL.fieldBg : undefined }}>
            <td style={cellStyle}><input type="checkbox" aria-label={`Select row ${index + 1}`} checked={selectedRows.includes(index)}
              onChange={e => onSelectionChange(e.target.checked ? [...selectedRows, index] : selectedRows.filter(i => i !== index))} /></td>
            {columns.map(column => <td key={column.key} title={gridCellText(row, column)} style={{ ...cellStyle,
              color: column.primary ? FL.brand : FL.fg, textDecoration: column.primary ? 'underline' : undefined }}>
              {gridCellText(row, column)}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {!rows.length && <p style={{ padding: '0 16px' }}>No rows returned.</p>}
      <div style={{ borderTop: `1px solid ${FL.stroke}`, padding: '10px 16px' }}>Rows: {rows.length} (preview){selectedRows.length > 0 ? ` · ${selectedRows.length} selected` : ''}</div>
    </div>
  </section>;
}
