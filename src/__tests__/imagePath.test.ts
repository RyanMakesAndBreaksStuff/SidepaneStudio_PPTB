import { describe, expect, it } from 'vitest';
import { getSafePreviewImageSrc, isSafeRelativeImagePath } from '../services/imagePath';

describe('getSafePreviewImageSrc', () => {
  for (const value of [
    'file:///x',
    'blob:abc',
    'WebResources/../../x',
    'a:b',
    'javascript:x',
    'data:x',
    '//x',
    'https://x',
    '',
  ]) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(getSafePreviewImageSrc(value)).toBeNull();
    });
  }

  for (const value of ['WebResources/img/x.png', 'new_/img.svg']) {
    it(`accepts ${value}`, () => {
      expect(getSafePreviewImageSrc(value)).toBe(value);
    });
  }

  it('trims surrounding whitespace before validating', () => {
    expect(getSafePreviewImageSrc('  new_/img.svg ')).toBe('new_/img.svg');
  });
});

describe('isSafeRelativeImagePath', () => {
  it('rejects colons, parent segments and disallowed characters', () => {
    expect(isSafeRelativeImagePath('a:b')).toBe(false);
    expect(isSafeRelativeImagePath('../x')).toBe(false);
    expect(isSafeRelativeImagePath('a/b c.png')).toBe(false);
  });

  it('rejects root-absolute paths', () => {
    expect(isSafeRelativeImagePath('/img/a.png')).toBe(false);
    expect(isSafeRelativeImagePath('//host/a.png')).toBe(false);
  });

  it('allows dots inside segment names', () => {
    expect(isSafeRelativeImagePath('a/b..c/x.png')).toBe(true);
  });
});
