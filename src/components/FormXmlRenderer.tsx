import * as React from 'react';
import { useState } from 'react';
import { FormModel, FormSection, FormCell } from '../services/FormXmlService';

// Fluent Light tokens — isolated from app theme (same invariant as PaneOverlay)
const FL = {
  pageBg: '#FAF9F8',
  surface: '#FFFFFF',
  fg: '#323130',
  fgLabel: '#605E5C',
  stroke: '#EDEBE9',
  tabActiveBorder: '#0078D4',
  tabActiveFg: '#0078D4',
  tabFg: '#605E5C',
  sectionHeaderBg: '#F3F2F1',
  font: "'Segoe UI', system-ui, sans-serif",
  mono: "'Cascadia Code', monospace",
  inputBg: '#FFFFFF',
  inputBorder: '#8A8886',
};

function DisabledInput({ type }: { type: FormCell['fieldType'] }): React.ReactElement {
  const base: React.CSSProperties = {
    width: '100%',
    padding: '3px 8px',
    border: `1px solid ${FL.inputBorder}`,
    borderRadius: 2,
    background: FL.inputBg,
    color: FL.fgLabel,
    fontFamily: FL.font,
    fontSize: 13,
    boxSizing: 'border-box',
    cursor: 'default',
  };
  if (type === 'memo') {
    return <textarea disabled style={{ ...base, height: 52, resize: 'none' }} />;
  }
  if (type === 'boolean' || type === 'picklist') {
    return (
      <select disabled style={base}>
        <option>—</option>
      </select>
    );
  }
  return <input type="text" disabled style={base} />;
}

function CellView({ cell }: { cell: FormCell }): React.ReactElement {
  if (cell.empty) return <div />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <label style={{ fontSize: 11, color: FL.fgLabel, fontFamily: FL.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {cell.label || cell.fieldName}
      </label>
      <DisabledInput type={cell.fieldType} />
    </div>
  );
}

function SectionView({ section }: { section: FormSection }): React.ReactElement {
  return (
    <div style={{ marginBottom: 12 }}>
      {section.showLabel && section.label && (
        <div style={{
          padding: '4px 12px',
          background: FL.sectionHeaderBg,
          borderBottom: `1px solid ${FL.stroke}`,
          fontSize: 11,
          fontWeight: 700,
          color: FL.fg,
          fontFamily: FL.font,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {section.label}
        </div>
      )}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {section.rows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: 'grid',
              gridTemplateColumns: section.columnCount >= 2 ? '1fr 1fr' : '1fr',
              gap: 12,
            }}
          >
            {row.cells.map((cell, ci) => (
              <div
                key={ci}
                style={{ gridColumn: cell.colspan > 1 ? `span ${cell.colspan}` : undefined }}
              >
                <CellView cell={cell} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface FormXmlRendererProps {
  model: FormModel;
}

export function FormXmlRenderer({ model }: FormXmlRendererProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState(0);

  if (model.tabs.length === 0) {
    return (
      <div style={{ padding: 24, color: FL.fgLabel, fontFamily: FL.font, fontSize: 13 }}>
        No tabs in form.
      </div>
    );
  }

  const currentTab = model.tabs[activeTab] ?? model.tabs[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: FL.pageBg, fontFamily: FL.font }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${FL.stroke}`, background: FL.surface, flexShrink: 0 }}>
        {model.tabs.map((tab, i) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: i === activeTab ? `2px solid ${FL.tabActiveBorder}` : '2px solid transparent',
              background: 'transparent',
              color: i === activeTab ? FL.tabActiveFg : FL.tabFg,
              fontFamily: FL.font,
              fontSize: 13,
              fontWeight: i === activeTab ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label || tab.name}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', background: FL.pageBg }}>
        {currentTab.sections.map(section => (
          <SectionView key={section.name} section={section} />
        ))}
      </div>
    </div>
  );
}
