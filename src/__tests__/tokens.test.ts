import { describe, expect, it } from 'vitest';
import { theme } from '../theme/tokens';

function lum(hex: string): number {
  const c = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe.each([['light', false], ['dark', true]] as const)('Newsprint %s tokens', (_, isDark) => {
  const T = theme(isDark);
  it('is the Newsprint palette', () => {
    expect(T.pageBg).toBe(isDark ? '#121212' : '#f2f2f2');
    expect(T.accent).toBe(isDark ? '#f5f5f5' : '#111111');
    expect(T.accentAlt).toBe(isDark ? '#ff8a65' : '#b8320f');
    expect(T.codeBg).toBe('#0f0f0f');
    expect(T.rS).toBe('0px');
    expect(T.rM).toBe('0px');
    expect('rFull' in T).toBe(false);
  });
  it.each([
    ['fg1', 'pageBg'], ['fg1', 'surface1'], ['fg1', 'surface2'], ['fg1', 'surface3'],
    ['fg2', 'pageBg'], ['fg2', 'surface1'], ['fg2', 'surface2'],
    ['fg3', 'pageBg'], ['fg3', 'surface1'], ['fg3', 'surface2'], ['fg3', 'surface3'],
    ['accent', 'pageBg'], ['accent', 'surface1'], ['accent', 'surface2'], ['accentFg', 'accent'],
    ['accentAlt', 'pageBg'], ['accentAlt', 'surface1'], ['fg1', 'accentBg'],
    ['error', 'pageBg'], ['error', 'surface1'], ['error', 'errBg'],
    ['warning', 'pageBg'], ['warning', 'surface1'], ['warning', 'warnBg'],
    ['success', 'pageBg'], ['success', 'surface1'], ['success', 'okBg'],
    ['info', 'pageBg'], ['info', 'surface1'], ['info', 'infoBg'],
    ['codeFg', 'codeBg'], ['codeFg', 'codeBg2'], ['codeFgMuted', 'codeBg'], ['codeFgMuted', 'codeBg2'],
    ['codeAccent', 'codeBg'], ['codeSuccess', 'codeBg'], ['codeWarning', 'codeBg'],
  ] as const)('text %s on %s ≥ 4.5:1', (fg, bg) => {
    expect(ratio(T[fg], T[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each([['strokeAcc', 'pageBg'], ['strokeAcc', 'surface1'], ['strokeAcc', 'surface2']] as const)(
    'control %s on %s ≥ 3:1', (fg, bg) => { expect(ratio(T[fg], T[bg])).toBeGreaterThanOrEqual(3); });
});
