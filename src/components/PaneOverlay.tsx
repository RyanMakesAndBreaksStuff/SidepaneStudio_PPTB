import * as React from 'react';
import { PaneConfig, TargetConfig } from '../types/PaneDefinitionConfig';
import { ValidationResult } from '../services/ValidationService';
import { getPreviewPaneWidth, getSafePreviewImageSrc } from './previewHelpers';

// Fluent Light tokens — hardcoded, isolated from app theme (same invariant as MockMDAShell)
const FL = {
  headerBg: '#0078D4',
  headerFg: '#FFFFFF',
  paneBg: '#FFFFFF',
  fg: '#323130',
  fgMuted: '#605E5C',
  stroke: '#EDEBE9',
  font: "'Segoe UI', system-ui, sans-serif",
};

interface PaneOverlayProps {
  pane: PaneConfig;
  target: TargetConfig;
  validation: ValidationResult;
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  entityrecord: 'Entity Record',
  entitylist: 'Entity List',
  webresource: 'Web Resource',
  custom: 'Custom Page',
  dashboard: 'Dashboard',
  search: 'Search',
};

export const PaneOverlay = React.memo(function PaneOverlay({
  pane,
  target,
  validation,
}: PaneOverlayProps): React.ReactElement | null {
  if (pane.isSelected === false) return null;

  const width = getPreviewPaneWidth(pane.width);
  const imageSrc = getSafePreviewImageSrc(pane.imageSrc);

  return (
    <div
      style={{
        width,
        minWidth: width,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `1px solid ${FL.stroke}`,
        background: FL.paneBg,
        fontFamily: FL.font,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      {!pane.hideHeader && (
        <div
          style={{
            height: 32,
            background: FL.headerBg,
            color: FL.headerFg,
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {imageSrc ? (
            <img src={imageSrc} alt="" style={{ width: 16, height: 16 }} />
          ) : (
            <span style={{ fontSize: 14 }}>🔲</span>
          )}
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pane.title || 'Side Pane'}
          </span>
          {pane.canClose && (
            <span style={{ fontSize: 14, cursor: 'default', opacity: 0.8 }}>✕</span>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: FL.fgMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {PAGE_TYPE_LABELS[target.pageType] ?? target.pageType}
        </div>
        {target.entityName && (
          <div style={{ fontSize: 12, color: FL.fg, fontWeight: 600 }}>{target.entityName}</div>
        )}
        {/* Placeholder content lines */}
        {[80, 60, 90, 50].map((w, i) => (
          <div
            key={i}
            style={{
              height: 8,
              width: `${w}%`,
              background: FL.stroke,
              borderRadius: 4,
            }}
          />
        ))}
        {validation.warnings.length > 0 && (
          <div style={{ fontSize: 10, color: '#D83B01', marginTop: 4 }}>
            ⚠ {validation.warnings.length} warning{validation.warnings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
});
