// src/theme/tokens.ts
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

const DARK: TokenSet = {
  pageBg: '#1A1A1A',
  surface1: '#2D2D21',
  surface2: '#30321A',
  surface3: '#1E201A',
  accentTeal: '#2BC0B0',
  accentOrange: '#E67E22',
  accentTealBg: 'rgba(43,192,176,.12)',
  fg1: '#E8E8E8',
  fg2: '#B0B0B0',
  fg3: '#808080',
  stroke1: '#3A3A3A',
  strokeAcc: '#5A5A5A',
  success: '#2ECC71',
  warning: '#F1C40F',
  error: '#E74C3C',
  info: '#3498DB',
  warnBg: 'rgba(241,196,15,.12)',
  errBg: 'rgba(231,76,60,.12)',
  okBg: 'rgba(46,204,113,.12)',
  infoBg: 'rgba(52,152,219,.12)',
  shadow2: '0 1px 2px rgba(0,0,0,.5),0 0 2px rgba(0,0,0,.3)',
  shadow4: '0 2px 4px rgba(0,0,0,.5),0 0 2px rgba(0,0,0,.3)',
  shadow8: '0 4px 8px rgba(0,0,0,.5),0 0 2px rgba(0,0,0,.3)',
  shadow16: '0 8px 20px rgba(0,0,0,.6),0 0 2px rgba(0,0,0,.3)',
  ...INVARIANT,
};

const LIGHT: TokenSet = {
  pageBg: '#FFFFFF',
  surface1: '#F0F0FA',
  surface2: '#FAFAFA',
  surface3: '#F5F5F5',
  accentTeal: '#1A9A8C',
  accentOrange: '#D4690F',
  accentTealBg: 'rgba(26,154,140,.10)',
  fg1: '#1A1A1A',
  fg2: '#424242',
  fg3: '#616161',
  stroke1: '#D1D1D1',
  strokeAcc: '#898989',
  success: '#107C10',
  warning: '#7D5400',
  error: '#A4000F',
  info: '#004578',
  warnBg: '#FFF8E7',
  errBg: '#FDF3F4',
  okBg: '#F1FAF1',
  infoBg: '#EBF3FC',
  shadow2: '0 1px 2px rgba(0,0,0,.14),0 0 2px rgba(0,0,0,.10)',
  shadow4: '0 2px 4px rgba(0,0,0,.14),0 0 2px rgba(0,0,0,.10)',
  shadow8: '0 4px 8px rgba(0,0,0,.14),0 0 2px rgba(0,0,0,.10)',
  shadow16: '0 8px 20px rgba(0,0,0,.16),0 0 2px rgba(0,0,0,.10)',
  ...INVARIANT,
};

export function theme(isDark: boolean): TokenSet {
  return isDark ? DARK : LIGHT;
}
