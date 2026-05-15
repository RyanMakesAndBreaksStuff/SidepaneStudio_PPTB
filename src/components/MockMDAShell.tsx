// src/components/MockMDAShell.tsx
// WARNING: DO NOT import ThemeContext, tokens.ts, or TokenSet here — use FLUENT_LIGHT only
import * as React from 'react';
import { useEffect } from 'react';
import { PaneConfig, TargetConfig } from '../types/PaneDefinitionConfig';
import { ValidationResult } from '../services/ValidationService';
import { PaneOverlay } from './PaneOverlay';

const FLUENT_LIGHT = {
  pageBg: '#FFFFFF', formBg: '#F3F2F1', navBg: '#F3F2F1', navStrip: '#EDEBE9',
  topbar: '#1B3A4B', topbarText: '#FFFFFF', brand: '#0078D4', brandHover: '#106EBE',
  paneBg: '#FFFFFF', paneHeader: '#0078D4', paneText: '#FFFFFF',
  cmdBg: '#FAF9F8', cmdBorder: '#EDEBE9', textPrimary: '#323130', textSecond: '#605E5C',
  stroke: '#EDEBE9', paneRail: '#EDEBE9', paneTab: '#FFFFFF',
  previewBadge: 'rgba(230,100,0,.88)',
  bg2: '#F5F5F5', bg3: '#F0F0F0',
  brandSelBg: '#EBF3FC',
  stroke1: '#D1D1D1',
  fg1: '#242424', fg2: '#424242', fg3: '#616161',
  warnBg: '#FFF8E7', warnBorder: '#F7AA00', warnFg: '#7D5400',
  shadow2: '0 1px 2px rgba(0,0,0,.14),0 0 2px rgba(0,0,0,.10)',
  shadow16: '0 8px 20px rgba(0,0,0,.16),0 0 2px rgba(0,0,0,.10)',
  rM: '4px', rL: '8px', rS: '2px',
  font: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,sans-serif",
} as const;

const SLIDE_IN_CSS = '@keyframes slideIn { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';

export interface MockMDAShellProps {
  pane: PaneConfig;
  target: TargetConfig;
  validation: ValidationResult;
}

export function MockMDAShell({ pane, target, validation }: MockMDAShellProps): React.ReactElement {
  const FL = FLUENT_LIGHT;
  const mappedWidth = Math.round(120 + ((pane.width - 300) / 700) * 150);

  // Q-8: Inject animation CSS once; avoid duplicate style tags on re-render
  useEffect(() => {
    if (!document.getElementById('spstudio-animations')) {
      const style = document.createElement('style');
      style.id = 'spstudio-animations';
      style.textContent = SLIDE_IN_CSS;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {/* Simulation badge */}
      <div style={{
        position: 'absolute', top: 6, right: 6, zIndex: 10,
        background: FL.previewBadge, color: 'white',
        fontSize: 8.5, fontWeight: 800, letterSpacing: '.8px',
        padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase',
      }}>
        PREVIEW SIMULATION
      </div>

      <div style={{
        background: 'white', borderRadius: FL.rL,
        boxShadow: FL.shadow16, width: '100%', maxWidth: 620,
        height: 360, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Topbar */}
        <div style={{ height: 36, background: FL.topbar, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, width: 16, height: 16, marginRight: 4 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ background: 'rgba(255,255,255,.5)', borderRadius: 1 }} />
            ))}
          </div>
          <span style={{ color: 'rgba(255,255,255,.9)', fontSize: 13, fontWeight: 600 }}>Dynamics 365</span>
          <div style={{ flex: 1 }} />
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'linear-gradient(135deg,#6264A7,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 10, fontWeight: 700,
          }}>AJ</div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Site nav */}
          <div style={{
            width: 44, background: FL.navBg, borderRight: `1px solid ${FL.stroke}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '6px 0', gap: 2, flexShrink: 0,
          }}>
            {['🏠', '📊', '👥', '📞'].map((ic, i) => (
              <div key={i} style={{
                width: 32, height: 32, borderRadius: FL.rM,
                background: i === 0 ? FL.navStrip : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: i === 0 ? FL.brand : FL.textSecond, fontSize: 13,
              }}>{ic}</div>
            ))}
          </div>

          {/* Form area */}
          <div style={{ flex: 1, background: FL.formBg, padding: 10, overflow: 'hidden' }}>
            <div style={{ background: 'white', borderRadius: FL.rM, padding: 12, height: '100%', boxShadow: FL.shadow2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: FL.fg1, marginBottom: 8 }}>Account: Contoso Ltd.</div>
              <div style={{
                height: 26, background: FL.bg2, borderRadius: FL.rS, marginBottom: 10,
                display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6,
              }}>
                <div style={{ height: 18, padding: '0 8px', background: 'white', border: `1px solid ${FL.stroke1}`, borderRadius: 2, fontSize: 10, color: FL.fg2, display: 'flex', alignItems: 'center' }}>✏ Edit</div>
                <div style={{ height: 18, padding: '0 8px', background: FL.brandSelBg, border: `1px solid ${FL.brand}`, borderRadius: 2, fontSize: 10, color: FL.brand, display: 'flex', alignItems: 'center' }}>🗂 {pane.title || 'Side Pane'}</div>
                <div style={{ height: 18, padding: '0 8px', background: 'white', border: `1px solid ${FL.stroke1}`, borderRadius: 2, fontSize: 10, color: FL.fg2, display: 'flex', alignItems: 'center' }}>⋯</div>
              </div>
              {[[60, 120], [80, 100, 60], [140], [70, 90]].map((row, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  {row.map((w, ci) => (
                    <div key={ci} style={{ height: 7, background: FL.bg3, borderRadius: 2, width: w }} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Pane rail */}
          <div style={{
            width: 38, background: FL.paneRail, borderLeft: `1px solid ${FL.stroke}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '6px 0', gap: 3, flexShrink: 0,
          }}>
            <div style={{
              width: 30, height: 48, borderRadius: FL.rM,
              background: 'white', boxShadow: FL.shadow2,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3,
            }}>
              <span style={{ fontSize: 13 }}>{pane.imageSrc ? '🖼' : '📋'}</span>
              <span style={{ fontSize: 8, color: FL.textSecond, textAlign: 'center', maxWidth: 30, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(pane.title || 'Pane').slice(0, 6)}
              </span>
            </div>
          </div>

          {/* Pane panel — only rendered when isSelected is true (pane is open/expanded) */}
          <PaneOverlay pane={pane} target={target} validation={validation} />
        </div>
      </div>

    </div>
  );
}
