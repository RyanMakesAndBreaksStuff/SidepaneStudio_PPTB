import * as React from 'react';
import { FL } from './flTokens';
import type { GridColumn } from '../services/GridViewModel';
import { gridCellText } from '../services/GridViewModel';

export function MockGrid({ rows, columns, viewName, selectedRow, onCommand }: {
  rows: Record<string, unknown>[];
  columns: GridColumn[];
  viewName: string;
  selectedRow: number | null;
  onCommand: (index: number) => void;
}): React.ReactElement {
  const cellStyle: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${FL.stroke}`, textAlign: 'left', whiteSpace: 'nowrap' };
  return <section aria-label="Grid preview" style={{ background: FL.appBg, color: FL.fg, minWidth: 0 }}>
    <div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
      <strong>{viewName}</strong>
      <button type="button" disabled={rows.length === 0} onClick={() => onCommand(selectedRow ?? 0)}>Preview command</button>
    </div>
    {selectedRow !== null && <p role="status">SelectedRow: row {selectedRow + 1} — {columns.length ? gridCellText(rows[selectedRow], columns[0]) : 'selected'} (simulation)</p>}
    {rows.length === 0 ? <p>No rows returned.</p> : <div style={{ overflow: 'auto' }}>
      <table aria-label={viewName} style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead><tr><th scope="col" style={cellStyle}>Command</th>{columns.map(column => <th scope="col" key={column.key} style={{ ...cellStyle, width: column.width }}>{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} style={{ background: selectedRow === index ? FL.navBg : undefined }}>
          <td style={cellStyle}><button type="button" aria-pressed={selectedRow === index} onClick={() => onCommand(index)}>Preview command for row {index + 1}</button></td>
          {columns.map(column => <td key={column.key} style={cellStyle}>{gridCellText(row, column)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
