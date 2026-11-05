// src/theme/tokens.ts
// Newsprint palette — light & dark variants.
// Source: Palette Sheet.dc.html (Newsprint). Pure greys; ink-black primary on paper in light,
// paper-white primary on ink in dark; vermilion secondary. Square corners, underlined chips.
//
// Rules carried from the sheet:
//   1. accent is both a fill and a text colour; anything drawn on an accent fill uses accentFg.
//   2. accentAlt (vermilion) is for hints and secondary emphasis, never for status —
//      success/warning/error/info keep their own hues.
//   3. The code well is dark in both modes and reads only code* tokens.

import { TokenSet } from './types';

const INVARIANT = {
  rS: '0px',
  rM: '0px',
  rL: '4px',
  rXL: '8px',
  font: "'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',system-ui,sans-serif",
  mono: "'Cascadia Code','Fira Code','Consolas','Courier New',monospace",
};

const CODE = {
  codeBg:      '#0f0f0f',
  codeBg2:     '#1b1b1b',
  codeStroke:  '#3a3a3a',
  codeFg:      '#e8e8e8',
  codeFgMuted: '#b0b0b0',
  codeAccent:  '#ff9c7a',
  codeSuccess: '#9fdba9',
  codeWarning: '#f2c46d',
};

// ────────────────────────────────────────────────────────────────────────────
// DARK — ink page · paper-white primary
// ────────────────────────────────────────────────────────────────────────────
const DARK: TokenSet = {
  pageBg:       '#121212',
  surface1:     '#1c1c1c',
  surface2:     '#252525',
  surface3:     '#303030',
  accent:       '#f5f5f5',
  accentStrong: '#ffffff',
  accentFg:     '#111111',
  accentAlt:    '#ff8a65',
  accentBg:     '#3b3b3b', // accent @ 18% over pageBg
  fg1:          '#f5f5f5', // 17.4:1
  fg2:          '#d9d9d9', // 13.3:1
  fg3:          '#b0b0b0', //  8.6:1
  stroke1:      '#424242',
  strokeAcc:    '#7c7c7c', //  3.7:1 on surface2
  success:      '#8fd69f',
  warning:      '#f2c46d',
  error:        '#ff9d98',
  info:         '#a9c4ff',
  okBg:         '#313d34', // success @ 18% over surface1
  warnBg:       '#433a2b',
  errBg:        '#453332',
  infoBg:       '#353a45',
  shadow2:   '0 1px 2px rgba(0,0,0,.4),0 0 2px rgba(0,0,0,.3)',
  shadow4:   '0 2px 4px rgba(0,0,0,.4),0 0 2px rgba(0,0,0,.3)',
  shadow8:   '0 4px 10px rgba(0,0,0,.45),0 0 2px rgba(0,0,0,.3)',
  shadow16:  '0 14px 36px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.4)',
  ...CODE,
  ...INVARIANT,
};

// ────────────────────────────────────────────────────────────────────────────
// LIGHT — paper page · ink-black primary
// ────────────────────────────────────────────────────────────────────────────
const LIGHT: TokenSet = {
  pageBg:       '#f2f2f2',
  surface1:     '#ffffff',
  surface2:     '#e6e6e6',
  surface3:     '#d9d9d9',
  accent:       '#111111',
  accentStrong: '#3a3a3a',
  accentFg:     '#ffffff',
  accentAlt:    '#b8320f',
  accentBg:     '#d7d7d7', // accent @ 12% over pageBg
  fg1:          '#111111', // 17.4:1
  fg2:          '#333333', // 11.4:1
  fg3:          '#545454', //  6.9:1
  stroke1:      '#c2c2c2',
  strokeAcc:    '#767676', //  3.6:1 on surface2
  success:      '#2d6a3c',
  warning:      '#7a4e00',
  error:        '#a4221e',
  info:         '#2c4f9c',
  okBg:         '#e6ede8', // success @ 12% over surface1
  warnBg:       '#efeae0',
  errBg:        '#f4e4e4',
  infoBg:       '#e6eaf3',
  shadow2:   '0 1px 2px rgba(0,0,0,.08),0 0 2px rgba(0,0,0,.05)',
  shadow4:   '0 2px 4px rgba(0,0,0,.09),0 0 2px rgba(0,0,0,.06)',
  shadow8:   '0 4px 10px rgba(0,0,0,.10),0 0 2px rgba(0,0,0,.06)',
  shadow16:  '0 10px 28px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06)',
  ...CODE,
  ...INVARIANT,
};

export function theme(isDark: boolean): TokenSet {
  return isDark ? DARK : LIGHT;
}
