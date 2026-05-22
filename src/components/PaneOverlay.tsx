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
  strokeStrong: '#D2D0CE',
  fgMuted: '#605E5C',
  stroke: '#EDEBE9',
  font: "'Segoe UI', system-ui, sans-serif",
};

interface PaneOverlayProps {
  pane: PaneConfig;
  target: TargetConfig;
  validation: ValidationResult;
  /**
   * inline = sit to the right of the form, fixed/clamped width.
   * stacked = full-width row beneath the form (compact layouts).
   * Defaults to inline for backwards compatibility.
   */
  layout?: 'inline' | 'stacked';
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  entityrecord: 'Entity Record',
  entitylist: 'Entity List',
  webresource: 'Web Resource',
  custom: 'Custom Page',
  dashboard: 'Dashboard',
  search: 'Search',
};

// ────────────────────────────────────────────────────────────────────────────
// Type-aware content skeletons — give each pageType a recognizable silhouette
// so the overlay's placeholder hints at what the pane will actually render.
// ────────────────────────────────────────────────────────────────────────────
const Bar = ({ w, h = 8 }: { w: string | number; h?: number }): React.ReactElement => (
  <div style={{ height: h, width: typeof w === 'number' ? `${w}%` : w, background: FL.stroke, borderRadius: 4 }} />
);

function EntityRecordSkeleton(): React.ReactElement {
  // Avatar + name, then label/value field rows.
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#DCE3FF' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <Bar w={70} />
          <Bar w={45} h={6} />
        </div>
      </div>
      {[['Email', 80], ['Phone', 60], ['Owner', 70]].map(([label, w]) => (
        <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 38, fontSize: 9, color: FL.fgMuted, textTransform: 'uppercase', letterSpacing: '.3px', flexShrink: 0 }}>{label}</div>
          <Bar w={`${w}%`} />
        </div>
      ))}
    </>
  );
}

function EntityListSkeleton(): React.ReactElement {
  // Mini grid: header row + 5 rows with cell bars.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
      <div style={{ display: 'flex', gap: 6, paddingBottom: 4, borderBottom: `1px solid ${FL.stroke}` }}>
        <div style={{ flex: 2 }}><Bar w="100%" h={6} /></div>
        <div style={{ flex: 1 }}><Bar w="100%" h={6} /></div>
        <div style={{ flex: 1 }}><Bar w="100%" h={6} /></div>
      </div>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0' }}>
          <div style={{ flex: 2 }}><Bar w={`${85 - i * 5}%`} /></div>
          <div style={{ flex: 1 }}><Bar w={`${60 + (i % 3) * 10}%`} /></div>
          <div style={{ flex: 1 }}><Bar w={`${40 + (i % 2) * 25}%`} /></div>
        </div>
      ))}
    </div>
  );
}

function CustomPageSkeleton({ name }: { name?: string }): React.ReactElement {
  // A bordered canvas surface with the page name, hatched fill, and a CTA chip.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        border: `1px dashed ${FL.strokeStrong}`,
        borderRadius: 6,
        padding: 10,
        backgroundImage: `repeating-linear-gradient(45deg, ${FL.stroke} 0 2px, transparent 2px 8px)`,
        minHeight: 70,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6,
      }}>
        <div style={{ fontSize: 10, color: FL.fgMuted, fontFamily: "'Cascadia Code','Consolas',monospace" }}>
          {name || 'canvas page'}
        </div>
        <div style={{ alignSelf: 'flex-start', padding: '3px 8px', background: '#FFFFFF', border: `1px solid ${FL.stroke}`, borderRadius: 999, fontSize: 9, color: FL.fgMuted }}>
          App canvas
        </div>
      </div>
      <Bar w={80} h={6} />
      <Bar w={50} h={6} />
    </div>
  );
}

function WebResourceSkeleton({ name }: { name?: string }): React.ReactElement {
  // Browser chrome bar with URL path + a content rectangle.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: '#FFFFFF', border: `1px solid ${FL.stroke}`, borderRadius: 4, minWidth: 0 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: ['#FF6058', '#FFBD2D', '#27CA3F'][i] }} />
        ))}
        <span style={{
          marginLeft: 4, fontSize: 9, color: FL.fgMuted,
          fontFamily: "'Cascadia Code','Consolas',monospace",
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>
          /{name || 'webresource.html'}
        </span>
      </div>
      <div style={{ height: 56, background: FL.stroke, borderRadius: 4 }} />
      <Bar w={70} h={6} />
    </div>
  );
}

function DashboardSkeleton(): React.ReactElement {
  // 2x2 tile grid suggesting charts/cards.
  const tile = (h: number, bars: number[]) => (
    <div style={{
      height: h, padding: 4, background: '#FFFFFF',
      border: `1px solid ${FL.stroke}`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2,
    }}>
      {bars.map((b, i) => (
        <div key={i} style={{ height: b, background: FL.stroke, borderRadius: 1 }} />
      ))}
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 2 }}>
      {tile(36, [6, 10, 14, 8])}
      {tile(36, [10, 6, 12, 4])}
      {tile(36, [4, 8, 12, 16])}
      {tile(36, [14, 6, 4, 10])}
    </div>
  );
}

function SearchSkeleton(): React.ReactElement {
  // Search input + result list with leading icons.
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', background: '#FFFFFF',
        border: `1px solid ${FL.stroke}`, borderRadius: 4,
      }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={FL.fgMuted} strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <Bar w={60} h={5} />
      </div>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: FL.stroke, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <Bar w={`${80 - i * 10}%`} h={6} />
            <Bar w={`${50 - i * 5}%`} h={5} />
          </div>
        </div>
      ))}
    </>
  );
}

function PaneContentSkeleton({ target }: { target: TargetConfig }): React.ReactElement {
  switch (target.pageType) {
    case 'entityrecord': return <EntityRecordSkeleton />;
    case 'entitylist':   return <EntityListSkeleton />;
    case 'custom':       return <CustomPageSkeleton name={target.name} />;
    case 'webresource':  return <WebResourceSkeleton name={target.name} />;
    case 'dashboard':    return <DashboardSkeleton />;
    case 'search':       return <SearchSkeleton />;
    default:             return <EntityRecordSkeleton />;
  }
}

export const PaneOverlay = React.memo(function PaneOverlay({
  pane,
  target,
  validation,
  layout = 'inline',
}: PaneOverlayProps): React.ReactElement | null {
  if (pane.isSelected === false) return null;

  const requestedWidth = getPreviewPaneWidth(pane.width);
  const imageSrc = getSafePreviewImageSrc(pane.imageSrc);
  const stacked = layout === 'stacked';

  // Inline: keep the requested width but cap so it can't crowd out the form
  //   when the simulated MDA window is narrow.
  // Stacked: full-width, fixed height — sits under the form on compact views.
  const wrapperStyle: React.CSSProperties = stacked
    ? {
        width: '100%',
        maxHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${FL.stroke}`,
        borderRadius: 6,
        background: FL.paneBg,
        fontFamily: FL.font,
        overflow: 'hidden',
      }
    : {
        flex: `0 1 ${requestedWidth}px`,
        width: requestedWidth,
        minWidth: 160,
        maxWidth: '50%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `1px solid ${FL.stroke}`,
        background: FL.paneBg,
        fontFamily: FL.font,
        overflow: 'hidden',
      };

  return (
    <div style={wrapperStyle}>
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
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {pane.title || 'Side Pane'}
          </span>
          {pane.canClose && (
            <span style={{ fontSize: 14, cursor: 'default', opacity: 0.8 }}>✕</span>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 10, color: FL.fgMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {PAGE_TYPE_LABELS[target.pageType] ?? target.pageType}
        </div>
        {target.entityName && (
          <div style={{ fontSize: 12, color: FL.fg, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {target.entityName}
          </div>
        )}
        {/* Type-aware skeleton — hints at what the live pane will actually render */}
        <PaneContentSkeleton target={target} />
        {validation.warnings.length > 0 && (
          <div style={{ fontSize: 10, color: '#D83B01', marginTop: 4 }}>
            ⚠ {validation.warnings.length} warning{validation.warnings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
});
