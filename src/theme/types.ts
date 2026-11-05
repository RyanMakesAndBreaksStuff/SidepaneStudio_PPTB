// src/theme/types.ts
export interface TokenSet {
  // Backgrounds
  pageBg: string;
  surface1: string;
  surface2: string;
  surface3: string;
  // Accents
  accent: string;        // primary — safe as fill and as text on pageBg/surface1/surface2
  accentStrong: string;  // pressed / hover state of accent fills
  accentFg: string;      // text and icons drawn on an accent fill
  accentAlt: string;     // secondary accent — hints, status lines
  accentBg: string;      // 12% (light) / 18% (dark) accent tint — selected chips, summary slots
  // Foreground
  fg1: string;
  fg2: string;
  fg3: string;
  // Strokes
  stroke1: string;   // dividers, card borders
  strokeAcc: string; // control strokes (≥ 3:1 on pageBg/surface1/surface2)
  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;
  // Semantic backgrounds
  warnBg: string;
  errBg: string;
  okBg: string;
  infoBg: string;
  // Code well (always dark, both modes)
  codeBg: string;
  codeBg2: string;
  codeStroke: string;
  codeFg: string;
  codeFgMuted: string;
  codeAccent: string;
  codeSuccess: string;
  codeWarning: string;
  // Shadows
  shadow2: string;
  shadow4: string;
  shadow8: string;
  shadow16: string;
  // Radii (invariant)
  rS: string;
  rM: string;
  rL: string;
  rXL: string;
  // Fonts (invariant)
  font: string;
  mono: string;
}
