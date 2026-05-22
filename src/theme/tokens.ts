// src/theme/tokens.ts
// Deep Ocean palette — light & dark variants.
// Source: design-system palette uploads (Deep Ocean — bioluminescent accents).

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
// DARK — Abyssal depths · bioluminescent accents
// ────────────────────────────────────────────────────────────────────────────
const DARK: TokenSet = {
  pageBg:       '#060D18', // Abyssal Dark
  surface1:     '#0C1A2E', // Trench Layer (input / subtle elevation)
  surface2:     '#112540', // Deep Shelf (panel headers / chips)
  surface3:     '#0A1426', // Between page and surface1 — subtle ambient
  accentTeal:   '#1AB8CC', // Bioluminescent Blue (primary)
  accentOrange: '#3DD6CC', // Seafoam (secondary accent — repurposed slot)
  accentTealBg: 'rgba(26,184,204,.14)',
  fg1:          '#D6EAF5', // AA text
  fg2:          '#95B5C8', // Between primary and muted
  fg3:          '#5A8FA8', // Muted Tide
  stroke1:      '#1A3D5C', // Subtle Current
  strokeAcc:    '#2E5876', // Stronger border
  success:      '#28B870',
  warning:      '#D4A443',
  error:        '#DF5C5C',
  info:         '#3AACD4',
  okBg:         'rgba(40,184,112,.14)',
  warnBg:       'rgba(212,164,67,.14)',
  errBg:        'rgba(223,92,92,.14)',
  infoBg:       'rgba(58,172,212,.14)',
  shadow2:      '0 1px 2px rgba(0,0,0,.5),0 0 2px rgba(0,0,0,.3)',
  shadow4:      '0 2px 4px rgba(0,0,0,.5),0 0 2px rgba(0,0,0,.3)',
  shadow8:      '0 4px 8px rgba(0,0,0,.5),0 0 2px rgba(0,0,0,.3)',
  shadow16:     '0 8px 20px rgba(0,0,0,.6),0 0 2px rgba(0,0,0,.3)',
  ...INVARIANT,
};

// ────────────────────────────────────────────────────────────────────────────
// LIGHT — Airy coastal light · bioluminescent accents
// ────────────────────────────────────────────────────────────────────────────
const LIGHT: TokenSet = {
  pageBg:       '#EEF6FC', // Ocean Mist
  surface1:     '#DCEEF8', // Shallow Tide (input / subtle elevation)
  surface2:     '#F8F4EC', // Warm Sand Shelf (panel headers / chips)
  surface3:     '#E8F1F8', // Between page and surface1 — subtle ambient
  accentTeal:   '#1080A0', // Bioluminescent Blue (primary)
  accentOrange: '#2A9A8A', // Seafoam (secondary accent — repurposed slot)
  accentTealBg: 'rgba(16,128,160,.10)',
  fg1:          '#06101A', // AA text
  fg2:          '#2A4858', // Between primary and muted
  fg3:          '#4A7A90', // Muted Tide
  stroke1:      '#C0D8E8', // Subtle Current
  strokeAcc:    '#9CBED2', // Stronger border
  success:      '#1A9055',
  warning:      '#B07A1A',
  error:        '#BB3A3A',
  info:         '#1A80B0',
  okBg:         '#E4F4EB',
  warnBg:       '#FBF1DF',
  errBg:        '#FAEAEA',
  infoBg:       '#E4F0F7',
  shadow2:      '0 1px 2px rgba(6,16,26,.10),0 0 2px rgba(6,16,26,.06)',
  shadow4:      '0 2px 4px rgba(6,16,26,.10),0 0 2px rgba(6,16,26,.06)',
  shadow8:      '0 4px 8px rgba(6,16,26,.12),0 0 2px rgba(6,16,26,.06)',
  shadow16:     '0 8px 20px rgba(6,16,26,.14),0 0 2px rgba(6,16,26,.06)',
  ...INVARIANT,
};

export function theme(isDark: boolean): TokenSet {
  return isDark ? DARK : LIGHT;
}
