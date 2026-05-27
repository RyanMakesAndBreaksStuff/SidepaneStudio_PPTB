import * as React from 'react';
import { PaneConfig, TargetConfig } from '../types/PaneDefinitionConfig';
import { ValidationResult } from '../services/ValidationService';
import { FormModel } from '../services/FormXmlService';
import { PaneOverlay } from './PaneOverlay';
import { usePreviewSize, PreviewSizeMode } from './previewSize';
import { FL } from './flTokens';

const PREVIEW_FRAME_MIN_H = 440;
const PREVIEW_FRAME_MAX_H = 760;
const PREVIEW_CHROME_HEIGHT = 220;

interface NativeMdaFrameProps {
  pane: PaneConfig;
  /** The simulated MDA host form (FormHeader label). Independent of pane config. */
  hostTarget: TargetConfig;
  /** The side pane's target (PaneOverlay content). Comes from config. */
  paneTarget: TargetConfig;
  validation: ValidationResult;
  /**
   * Optional caption shown in the simulation strip above the frame, e.g.
   * "Mock host: Account · fixed sample data". Used to set the user's
   * expectations about whether the surrounding form reflects their config.
   */
  caption?: string;
  /** When provided, the header renders dynamic entity/form metadata instead of static mock data. */
  formModel?: FormModel;
  children: React.ReactNode;
}

function CommandButton({
  label,
  icon,
  primary,
  overflow,
}: {
  label?: string;
  icon: React.ReactNode;
  primary?: boolean;
  overflow?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: overflow ? '0 6px' : (label ? '0 10px' : '0 6px'),
        border: 'none',
        background: 'transparent',
        color: primary ? FL.brand : FL.fg2,
        fontFamily: FL.font,
        fontSize: 12,
        fontWeight: primary ? 600 : 500,
        borderRadius: 4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = FL.fieldBg)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span aria-hidden="true" style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'currentColor' }}>
        {icon}
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

// Small inline SVG glyphs — geometric, monochrome, currentColor-driven.
const Glyph = {
  save: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 2.5h7.5L13 5v8.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5Z" />
      <path d="M5 2.5v4h5v-4M5 10h6" />
    </svg>
  ),
  saveClose: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 2.5h7.5L13 5v8.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5Z" />
      <path d="M6 9.5l1.5 1.5L11 7.5" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  more: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3.5" cy="8" r="1.1" />
      <circle cx="8"   cy="8" r="1.1" />
      <circle cx="12.5" cy="8" r="1.1" />
    </svg>
  ),
}

function AppHeader({ mode }: { mode: PreviewSizeMode }): React.ReactElement {
  const showSubtitle = mode !== 'compact';

  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        gap: mode === 'compact' ? 8 : 12,
        padding: '0 12px',
        background: FL.surface,
        borderBottom: `1px solid ${FL.stroke}`,
        flexShrink: 0,
        color: FL.fg,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>P</div>
      <div style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>Power Apps</div>
      {showSubtitle && (
        <>
          <div style={{ width: 1, height: 18, background: FL.strokeStrong, flexShrink: 0 }} />
          <div
            style={{
              fontSize: 13,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Side Pane Studio
          </div>
        </>
      )}
      <div style={{ flex: 1, minWidth: 0 }} />
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          border: `1px solid ${FL.strokeStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: FL.fg2,
          flexShrink: 0,
        }}
      >
        RM
      </div>
    </div>
  );
}

function SiteMap({ mode }: { mode: PreviewSizeMode }): React.ReactElement | null {
  // Show the sitemap only at wide widths. At regular it'd be a hollow rail
  // (we removed the single-letter placeholders), and compact already hides it.
  if (mode !== 'wide') return null;

  const items = ['Home', 'Recent', 'Pinned', 'Accounts', 'Contacts'];

  return (
    <nav
      aria-label="Preview sitemap"
      style={{
        width: 116,
        background: FL.navBg,
        borderRight: `1px solid ${FL.stroke}`,
        padding: '8px 0',
        flexShrink: 0,
        color: FL.fg2,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '0 12px 12px', color: FL.fgMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>
        Menu
      </div>
      {items.map(label => (
        <div
          key={label}
          style={{
            height: 34,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            position: 'relative',
            fontSize: 13,
            fontWeight: label === 'Accounts' ? 600 : 400,
            color: label === 'Accounts' ? FL.fg : FL.fg2,
          }}
        >
          {label === 'Accounts' && (
            <span style={{ position: 'absolute', left: 0, top: 5, bottom: 5, width: 3, borderRadius: 2, background: FL.brand }} />
          )}
          <span>{label}</span>
        </div>
      ))}
      <div style={{ marginTop: 10, padding: '8px 12px', borderTop: `1px solid ${FL.stroke}`, fontWeight: 600, fontSize: 12 }}>
        Data
      </div>
    </nav>
  );
}

function entityInitials(entityName: string): string {
  const words = entityName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return entityName.slice(0, 2).toUpperCase();
}

function capitalizeEntity(entityName: string): string {
  if (!entityName) return 'Account';
  return entityName[0].toUpperCase() + entityName.slice(1);
}

function FormHeader({ target, mode, formModel }: { target: TargetConfig; mode: PreviewSizeMode; formModel?: FormModel }): React.ReactElement {
  const entityLabel = target.entityName || 'account';
  const isCompact = mode === 'compact';
  const isDynamic = formModel != null;

  const title = isDynamic
    ? `${capitalizeEntity(entityLabel)} (sample)`
    : 'Alpine Ski House (sample)';
  const initials = isDynamic
    ? entityInitials(entityLabel)
    : 'AS';
  const subtitle = isDynamic
    ? `${entityLabel} · ${capitalizeEntity(entityLabel)}`
    : `${entityLabel} · Account`;

  const stats: [string, string][] = [
    ['$90,000.00', 'Annual Revenue'],
    ['4,800', 'Number of Employees'],
    ['Sample Owner', 'Owner'],
  ];
  const visibleStats = isDynamic
    ? []
    : mode === 'wide' ? stats
    : mode === 'regular' ? stats.slice(0, 2)
    : []; // compact stacks stats below

  return (
    <section
      style={{
        margin: isCompact ? '10px 10px 8px' : '10px 12px 8px',
        border: `1px solid ${FL.stroke}`,
        borderRadius: 8,
        background: FL.surface,
        boxShadow: FL.shadow,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          rowGap: 8,
          columnGap: 12,
          minHeight: isDynamic ? undefined : 68,
          padding: '8px 14px',
        }}
      >
        <div style={{ fontSize: 22, color: FL.fgSubtle, flexShrink: 0 }}>{'<'}</div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#DCE3FF',
            color: '#36438D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: '1 1 160px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: FL.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
            <div style={{ color: FL.fgMuted, fontSize: 12, flexShrink: 0 }}>- Saved</div>
          </div>
          <div style={{ color: FL.fgMuted, fontSize: 12 }}>{subtitle}</div>
        </div>

        {visibleStats.map(([value, label]) => (
          <div
            key={label}
            style={{
              borderLeft: `1px solid ${FL.stroke}`,
              paddingLeft: 12,
              minWidth: label === 'Owner' ? 130 : 86,
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 13, color: FL.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
            <div style={{ fontSize: 11, color: FL.fgMuted }}>{label}</div>
          </div>
        ))}

        {/* Action cluster — real Fluent-style command buttons with icon + label */}
        {isCompact ? (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <CommandButton icon={Glyph.save} label="Save" primary />
            <CommandButton icon={Glyph.more} overflow />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              borderLeft: `1px solid ${FL.stroke}`,
              paddingLeft: 8,
              marginLeft: 4,
              flexShrink: 0,
            }}
          >
            <CommandButton icon={Glyph.save} label="Save" primary />
            {mode === 'wide' && <CommandButton icon={Glyph.saveClose} label="Save & Close" primary />}
            <CommandButton icon={Glyph.plus} label="New" />
            <CommandButton icon={Glyph.more} overflow />
          </div>
        )}
      </div>

      {/* Stat strip below the title row when compact */}
      {isCompact && !isDynamic && (
        <div style={{ display: 'flex', gap: 16, padding: '0 14px 10px', flexWrap: 'wrap' }}>
          {stats.slice(0, 2).map(([value, label]) => (
            <div key={label} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: FL.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
              <div style={{ fontSize: 11, color: FL.fgMuted }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs are rendered by FormXmlRenderer when a real form is loaded; keep static tabs for mock mode only. */}
      {!isDynamic && (
        <div style={{ display: 'flex', gap: 22, padding: '0 26px', height: 34, alignItems: 'flex-end', overflow: 'hidden' }}>
          {['Summary', 'Details', 'Related'].map((tab, index) => (
            <div
              key={tab}
              style={{
                height: 30,
                color: FL.fg,
                fontSize: 13,
                fontWeight: index === 0 ? 600 : 400,
                borderBottom: index === 0 ? `3px solid ${FL.brand}` : '3px solid transparent',
                flexShrink: 0,
              }}
            >
              {tab}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function NativeMdaFrame({ pane, hostTarget, paneTarget, validation, caption, formModel, children }: NativeMdaFrameProps): React.ReactElement {
  const { mode } = usePreviewSize();
  const isCompact = mode === 'compact';

  // Pane overlay sits on the right side at regular+wide; stacks below in compact.
  const showOverlayInline = !isCompact && pane.isSelected !== false;
  const showOverlayStacked = isCompact && pane.isSelected !== false;

  return (
    <div style={{ position: 'relative', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Simulation strip — sits ABOVE the rounded frame so it never overlaps
          AppHeader content. Carries the "Preview Simulation" indicator and an
          optional caption set by the parent (e.g. "Mock host: Account·fixed sample data"). */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '2px 8px',
          fontFamily: FL.font,
          fontSize: 10,
          color: FL.fgMuted,
          minWidth: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'rgba(230,100,0,.88)',
            boxShadow: '0 0 4px rgba(230,100,0,.55)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontWeight: 700,
            letterSpacing: '.8px',
            textTransform: 'uppercase',
            color: 'rgba(230,100,0,.88)',
            flexShrink: 0,
          }}
        >
          Preview Simulation
        </span>
        {caption && (
          <>
            <span style={{ color: FL.stroke, flexShrink: 0 }}>│</span>
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {caption}
            </span>
          </>
        )}
      </div>
      <div
        style={{
          background: FL.appBg,
          borderRadius: 8,
          boxShadow: FL.shadowPanel,
          width: '100%',
          // Height adapts: fills available room with a sensible floor/ceiling
          // instead of being locked at 520. clamp lets the frame breathe on
          // tall layouts and stay compact on short ones.
          minHeight: 420,
          height: `clamp(${PREVIEW_FRAME_MIN_H}px, calc(100vh - ${PREVIEW_CHROME_HEIGHT}px), ${PREVIEW_FRAME_MAX_H}px)`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: FL.font,
          color: FL.fg,
          minWidth: 0,
        }}
      >
        <AppHeader mode={mode} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
          <SiteMap mode={mode} />
          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: FL.appBg }}>
            <FormHeader target={hostTarget} mode={mode} formModel={formModel} />
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                gap: 10,
                padding: isCompact ? '0 10px 10px' : '0 12px 12px',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
                {children}
                {showOverlayStacked && (
                  <div style={{ marginTop: 10 }}>
                    <PaneOverlay pane={pane} target={paneTarget} validation={validation} layout="stacked" />
                  </div>
                )}
              </div>
              {showOverlayInline && (
                <PaneOverlay pane={pane} target={paneTarget} validation={validation} layout="inline" />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
