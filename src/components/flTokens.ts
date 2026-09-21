import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme/tokens';
import type { TokenSet } from '../theme/types';

/**
 * Preview token names retained for the mock form/grid consumers. Values are
 * always derived from the authoritative theme TokenSet.
 */
export interface FLTokens {
  appBg: string;
  brand: string;
  brandDark: string;
  cardBg: string;
  fieldBg: string;
  font: string;
  fg: string;
  fg2: string;
  fgLabel: string;
  fgMuted: string;
  fgSubtle: string;
  green: string;
  navBg: string;
  pageBg: string;
  purple: string;
  shadow: string;
  shadowPanel: string;
  stroke: string;
  strokeStrong: string;
  surface: string;
  tabActiveBorder: string;
  tabActiveFg: string;
  tabFg: string;
  headerBg: string;
  headerFg: string;
  paneBg: string;
  infoBg: string;
  success: string;
  warning: string;
  error: string;
}

// This is the requested light-mode preview color for muted/label text.
const LIGHT_PREVIEW_MUTED = '#5BD08D';

export function getFlTokens(T: TokenSet, isDark: boolean): FLTokens {
  const previewMuted = isDark ? T.accentAlt : LIGHT_PREVIEW_MUTED;

  return {
    appBg: T.pageBg,
    brand: T.accent,
    brandDark: T.accentAlt,
    cardBg: T.surface1,
    fieldBg: T.surface3,
    font: T.font,
    fg: T.fg1,
    fg2: T.fg2,
    fgLabel: previewMuted,
    fgMuted: previewMuted,
    fgSubtle: T.fg3,
    green: T.success,
    navBg: T.accentBg,
    pageBg: T.pageBg,
    purple: T.info,
    shadow: T.shadow2,
    shadowPanel: T.shadow8,
    stroke: T.stroke1,
    strokeStrong: T.strokeAcc,
    surface: T.surface1,
    tabActiveBorder: T.accent,
    tabActiveFg: T.accent,
    tabFg: previewMuted,
    headerBg: T.accent,
    headerFg: T.surface1,
    paneBg: T.surface1,
    infoBg: T.infoBg,
    success: T.success,
    warning: T.warning,
    error: T.error,
  };
}

export function useFlTokens(): FLTokens {
  const { isDark } = useTheme();
  return getFlTokens(theme(isDark), isDark);
}
