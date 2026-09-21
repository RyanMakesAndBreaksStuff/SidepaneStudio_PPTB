import * as React from 'react';
import { FL } from './flTokens';

const FORMATTED = '@OData.Community.Display.V1.FormattedValue';
function cellText(row: Record<string, unknown>, key: string): string {
  const value = row[`${key}${FORMATTED}`] ?? row[key];
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function MockGrid({ rows, viewName, selectedRow, onCommand }: {
  rows: Record<string, unknown>[];
  viewName: string;
  selectedRow: number | null;
  onCommand: (index: number) => void;
}): React.ReactElement {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row)
    .filter(key => !key.includes('@') || key.endsWith(FORMATTED))
    .map(key => key.endsWith(FORMATTED) ? key.slice(0, -FORMATTED.length) : key))));
  const cellStyle: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${FL.stroke}`, textAlign: 'left', whiteSpace: 'nowrap' };
  return <section aria-label="Grid preview" style={{ background: FL.appBg, color: FL.fg, minWidth: 0 }}>
    <div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
      <strong>{viewName}</strong>
      <button type="button" disabled={rows.length === 0} onClick={() => onCommand(selectedRow ?? 0)}>Preview command</button>
    </div>
    {selectedRow !== null && <p role="status">SelectedRow: row {selectedRow + 1} — {columns.length ? cellText(rows[selectedRow], columns[0]) : 'selected'} (simulation)</p>}
    {rows.length === 0 ? <p>No rows returned.</p> : <div style={{ overflow: 'auto' }}>
      <table aria-label={viewName} style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead><tr><th scope="col" style={cellStyle}>Command</th>{columns.map(column => <th scope="col" key={column} style={cellStyle}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} style={{ background: selectedRow === index ? FL.navBg : undefined }}>
          <td style={cellStyle}><button type="button" aria-pressed={selectedRow === index} onClick={() => onCommand(index)}>Preview command for row {index + 1}</button></td>
          {columns.map(column => <td key={column} style={cellStyle}>{cellText(row, column)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}