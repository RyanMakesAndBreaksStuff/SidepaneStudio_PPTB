import * as React from 'react';
import { useState } from 'react';
import { FormModel, FormSection, FormCell } from '../services/FormXmlService';

import { FL } from './flTokens';
function DisabledInput({ type }: { type: FormCell['fieldType'] }): React.ReactElement {
  const base: React.CSSProperties = {
    width: '100%',
    minHeight: 30,
    padding: '0 10px',
    border: 'none',
    borderRadius: 4,
    background: FL.fieldBg,
    color: FL.fgSubtle,
    fontFamily: FL.font,
    fontSize: 13,
    boxSizing: 'border-box',
    cursor: 'default',
  };
  if (type === 'memo') {
    return <textarea disabled value="---" readOnly style={{ ...base, height: 54, resize: 'none', paddingTop: 7 }} />;
  }
  if (type === 'boolean' || type === 'picklist') {
    return (
      <select disabled value="" style={base}>
        <option value="">---</option>
      </select>
    );
  }
  return <input type="text" disabled value="---" readOnly style={base} />;
}

function CellView({ cell }: { cell: FormCell }): React.ReactElement {
  if (cell.empty) return <div />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 38%) minmax(0, 1fr)', alignItems: 'center', gap: 14, minWidth: 0 }}>
      <label style={{ fontSize: 13, color: FL.fg, fontFamily: FL.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {cell.label || cell.fieldName}
      </label>
      <DisabledInput type={cell.fieldType} />
    </div>
  );
}

function SectionView({ section }: { section: FormSection }): React.ReactElement {
  return (
    <section
      style={{
        marginBottom: 10,
        background: FL.surface,
        border: `1px solid ${FL.stroke}`,
        borderRadius: 8,
        boxShadow: FL.shadow,
        overflow: 'hidden',
      }}
    >
      {section.showLabel && section.label && (
        <div style={{
          padding: '12px 14px 8px',
          fontSize: 13,
          fontWeight: 600,
          color: FL.fg,
          fontFamily: FL.font,
          textTransform: 'uppercase',
        }}>
          {section.label}
        </div>
      )}
      <div style={{ padding: section.showLabel && section.label ? '8px 14px 14px' : 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {section.rows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: 'grid',
              gridTemplateColumns: section.columnCount >= 2 ? '1fr 1fr' : '1fr',
              gap: 14,
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
    </section>
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
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: FL.pageBg, fontFamily: FL.font }}>
      {/* Tab strip */}
      {model.tabs.length > 1 && <div style={{ display: 'flex', borderBottom: `1px solid ${FL.stroke}`, background: FL.surface, flexShrink: 0, marginBottom: 10, borderRadius: 8 }}>
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
      </div>}

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'visible', background: FL.pageBg }}>
        {currentTab.sections.map(section => (
          <SectionView key={section.name} section={section} />
        ))}
      </div>
    </div>
  );
}
