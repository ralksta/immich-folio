import { describe, it, expect } from 'vitest';
import { compareVersions, isNewerVersion, parseLatestTag } from '@/lib/updateCheck';

describe('compareVersions', () => {
  it.each([
    ['0.12.0', '0.12.0', 0],
    ['0.12.1', '0.12.0', 1],
    ['0.12.0', '0.12.1', -1],
    ['1.0.0', '0.99.99', 1],
    ['0.13.0', '0.9.0', 1],
  ])('%s vs %s', (a, b, expected) => {
    expect(Math.sign(compareVersions(a, b))).toBe(expected);
  });

  /** 10 must not sort before 9, which is what a string compare would do. */
  it('compares numerically, not lexically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('0.2.0', '0.10.0')).toBeLessThan(0);
  });

  it('tolerates the leading v the releases API uses', () => {
    expect(compareVersions('v0.12.0', '0.12.0')).toBe(0);
    expect(compareVersions('V0.13.0', '0.12.0')).toBeGreaterThan(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.1', '1.0.9')).toBeGreaterThan(0);
  });

  it('compares a pre-release on its numbers alone', () => {
    expect(compareVersions('0.13.0-rc.1', '0.12.0')).toBeGreaterThan(0);
    expect(compareVersions('0.12.0-rc.1', '0.12.0')).toBe(0);
  });

  it('does not crash on rubbish', () => {
    expect(() => compareVersions('', 'x.y.z')).not.toThrow();
    expect(compareVersions('x.y.z', '')).toBe(0);
  });
});

describe('isNewerVersion', () => {
  it('is true only for a strictly newer release', () => {
    expect(isNewerVersion('0.13.0', '0.12.0')).toBe(true);
    expect(isNewerVersion('0.12.0', '0.12.0')).toBe(false);
    expect(isNewerVersion('0.11.0', '0.12.0')).toBe(false);
  });

  /** A downgraded tag must never be advertised as an update. */
  it('does not nag when running ahead of the latest release', () => {
    expect(isNewerVersion('v0.12.0', '0.13.0-dev')).toBe(false);
  });
});

describe('parseLatestTag', () => {
  it('reads tag_name', () => {
    expect(parseLatestTag({ tag_name: 'v0.13.0' })).toBe('v0.13.0');
  });

  it('trims surrounding whitespace', () => {
    expect(parseLatestTag({ tag_name: '  v0.13.0 ' })).toBe('v0.13.0');
  });

  it.each([
    ['null', null],
    ['a string', 'v0.13.0'],
    ['an array', []],
    ['an error object served with 200', { message: 'API rate limit exceeded' }],
    ['a non-string tag', { tag_name: 42 }],
    ['a tag that is not a version', { tag_name: 'nightly' }],
    // The check only guarded the *start* of the tag, so anything beginning
    // with a digit slipped through and was then compared as a version. A
    // date-style tag reads as version 2024 and leaves every instance showing
    // an update that does not exist, permanently.
    ['a date-style tag', { tag_name: '2024-01-05' }],
    ['a tag with a digit and then rubbish', { tag_name: '1abc' }],
  ])('returns null for %s', (_label, payload) => {
    expect(parseLatestTag(payload)).toBeNull();
  });

  it('still accepts the shapes the project actually tags', () => {
    expect(parseLatestTag({ tag_name: 'v0.13.0' })).toBe('v0.13.0');
    expect(parseLatestTag({ tag_name: '0.13.0' })).toBe('0.13.0');
    expect(parseLatestTag({ tag_name: 'v1.0' })).toBe('v1.0');
    expect(parseLatestTag({ tag_name: 'v1.2.3-rc1' })).toBe('v1.2.3-rc1');
    // Build metadata is ignorable for ordering, so rejecting it would mean
    // never mentioning a release that is genuinely newer.
    expect(parseLatestTag({ tag_name: 'v1.2.3+build.7' })).toBe('v1.2.3+build.7');
  });
});
