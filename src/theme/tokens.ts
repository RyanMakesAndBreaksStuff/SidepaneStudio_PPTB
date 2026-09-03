// src/theme/tokens.ts
// Kiln palette — light & dark variants.
// Source: kiln-color-sheet.html (charcoal + citron, dual mode).
//
// Two hard rules from the sheet:
//   1. Citron is a fill, never a font on a light surface.
//   2. Citron never encodes status — success/error stay emerald/brick.

import { TokenSet } from './types';

const INVARIANT = {
  rS: '2px',
  rM: '4px',
  rL: '8px',
  rXL: '12px',
  rFull: '9999px',
  font: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,sans-serif",
  mono: "'Cascadia Code','Fira Code','Consolas','Courier New',monospace",
};

// ────────────────────────────────────────────────────────────────────────────
// DARK — kiln interior · citron accent on ink
// ────────────────────────────────────────────────────────────────────────────
const DARK: TokenSet = {
  pageBg:    '#191816', // PageBg — content region
  surface1:  '#201F1C', // CardBg — cards, dialogs, inputs
  surface2:  '#2A2825', // SubtleBg — table headers, chips
  surface3:  '#171613', // InsetBg — console, disabled fields
  accent:    '#BADD52', // AccentFill — citron (fill, and text on dark only)
  accentAlt: '#9DCB1F', // EnergyFill — progress arcs, gradient partner
  accentBg:  '#24290F', // AccentTint — selected nav, info banner
  fg1:       '#F2F0EA', // TextPrimary   15.6:1
  fg2:       '#B4AFA3', // TextSecondary  8.1:1
  fg3:       '#8B857A', // TextTertiary   4.8:1
  stroke1:   '#2E2C28', // DividerStroke
  strokeAcc: '#3D3A34', // ControlStroke
  success:   '#5BD08D', // emerald — deliberately not citron
  warning:   '#E8B04B',
  error:     '#FF8E80', // brick
  info:      '#6FB4D6', // series S4 (Kiln has no info token)
  okBg:      '#14251C', // SuccessTint
  warnBg:    '#2C2313', // WarningTint
  errBg:     '#2E1815', // DangerTint
  infoBg:    '#16242B', // derived from S4
  shadow2:   '0 1px 2px rgba(0,0,0,.4),0 0 2px rgba(0,0,0,.3)',
  shadow4:   '0 2px 4px rgba(0,0,0,.4),0 0 2px rgba(0,0,0,.3)',
  shadow8:   '0 4px 10px rgba(0,0,0,.45),0 0 2px rgba(0,0,0,.3)',
  shadow16:  '0 14px 36px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.4)',
  ...INVARIANT,
};

// ────────────────────────────────────────────────────────────────────────────
// LIGHT — warm paper · olive accent, charcoal ink
// ────────────────────────────────────────────────────────────────────────────
const LIGHT: TokenSet = {
  pageBg:    '#FAF9F5', // PageBg — content region
  surface1:  '#FFFFFF', // CardBg — cards, dialogs, inputs
  surface2:  '#EAE8E0', // SubtleBg — table headers, chips
  surface3:  '#F4F2EB', // InsetBg — console, disabled fields
  accent:    '#5F7F0B', // SelectionIndicator — olive; safe as fill and as text
  accentAlt: '#262420', // AccentFill — charcoal; gradient partner
  accentBg:  '#F0F6D9', // AccentTint — selected nav, info banner
  fg1:       '#1C1B18', // TextPrimary   17.2:1
  fg2:       '#5C584E', // TextSecondary  7.1:1
  fg3:       '#7A7568', // TextTertiary   4.6:1
  stroke1:   '#E3E0D7', // DividerStroke
  strokeAcc: '#D2CEC3', // ControlStroke
  success:   '#1F7A4D', // emerald — deliberately not citron
  warning:   '#92610A',
  error:     '#B3261E', // brick
  info:      '#2B5F7A', // series S4 (Kiln has no info token)
  okBg:      '#E4F4EA', // SuccessTint
  warnBg:    '#FBF0D8', // WarningTint
  errBg:     '#FBEAE7', // DangerTint
  infoBg:    '#E7EFF3', // derived from S4
  shadow2:   '0 1px 2px rgba(28,26,22,.06),0 0 2px rgba(28,26,22,.04)',
  shadow4:   '0 2px 4px rgba(28,26,22,.07),0 0 2px rgba(28,26,22,.05)',
  shadow8:   '0 4px 10px rgba(28,26,22,.08),0 0 2px rgba(28,26,22,.05)',
  shadow16:  '0 10px 28px rgba(28,26,22,.10),0 1px 2px rgba(28,26,22,.05)',
  ...INVARIANT,
};

export function theme(isDark: boolean): TokenSet {
  return isDark ? DARK : LIGHT;
}
