import { describe, it, expect } from 'vitest';
import {
  aspectDrift,
  formatDimensions,
  imageAspect,
  parseDimensions,
  toFeetInches,
} from '../lib/dimensions';

/**
 * Every string below is a shape the live `artworks.dimensions` column actually
 * takes (see the backfill migration and the catalog screenshots).
 */
describe('parseDimensions', () => {
  it('reads quoted inches', () => {
    expect(parseDimensions('48" x 60"')).toMatchObject({ widthIn: 48, heightIn: 60, inFeet: false });
  });

  it('reads feet and converts to inches', () => {
    // "3.5ft x 5ft" is the same work the record also states as 42 × 60 in.
    expect(parseDimensions('3.5ft x 5ft')).toMatchObject({ widthIn: 42, heightIn: 60, inFeet: true });
    expect(parseDimensions('5ft x 4ft')).toMatchObject({ widthIn: 60, heightIn: 48 });
  });

  it('ignores a parenthetical metric restatement', () => {
    expect(parseDimensions('42 x 60 in (107 × 152 cm)')).toMatchObject({ widthIn: 42, heightIn: 60 });
    expect(parseDimensions('3.5ft x 5ft (3.5FT X 5FT)')).toMatchObject({ widthIn: 42, heightIn: 60 });
    expect(parseDimensions('36 × 48 in (91 × 122 cm)')).toMatchObject({ widthIn: 36, heightIn: 48 });
  });

  it('treats a bare number pair as inches, not feet', () => {
    // "8 x 10" is a small study. Inflating it to 96" × 120" would be absurd.
    expect(parseDimensions('8 x 10')).toMatchObject({ widthIn: 8, heightIn: 10, inFeet: false });
  });

  it('resolves orientation', () => {
    expect(parseDimensions('48" x 60"').orientation).toBe('portrait');
    expect(parseDimensions('60" x 48"').orientation).toBe('landscape');
    expect(parseDimensions('48" x 48"').orientation).toBe('square');
  });

  it('reports unresolved input instead of guessing', () => {
    for (const raw of ['- (-)', '', '   ', null, undefined, 'unknown', 'TBD']) {
      const parsed = parseDimensions(raw as string);
      expect(parsed.resolved).toBe(false);
      expect(parsed.widthIn).toBeNull();
      expect(parsed.orientation).toBe('unknown');
    }
  });
});

describe('formatDimensions', () => {
  it('produces imperial and metric readings', () => {
    const formatted = formatDimensions('48" x 60"');
    expect(formatted.imperial).toBe('48 × 60 in');
    expect(formatted.metric).toBe('122 × 152 cm');
    expect(formatted.label).toBe('48 × 60 in (122 × 152 cm)');
  });

  it('keeps one decimal place where the source had one', () => {
    expect(formatDimensions('3.5ft x 5ft').imperial).toBe('42 × 60 in');
  });

  it('falls back to the raw string when it cannot be parsed', () => {
    const formatted = formatDimensions('- (-)');
    expect(formatted.imperial).toBe('');
    expect(formatted.metric).toBe('');
    expect(formatted.label).toBe('- (-)');
  });

  it('renders a feet-and-inches reading for large works', () => {
    expect(formatDimensions('42 x 60 in').feetLabel).toBe('3′ 6″ × 5′');
  });
});

describe('toFeetInches', () => {
  it('handles whole feet, whole inches and mixtures', () => {
    expect(toFeetInches(60)).toBe('5′');
    expect(toFeetInches(10)).toBe('10″');
    expect(toFeetInches(42)).toBe('3′ 6″');
  });
});

describe('aspect comparison', () => {
  it('derives an aspect ratio from renditions', () => {
    expect(imageAspect(1280, 640)).toBe(2);
    expect(imageAspect(0, 640)).toBeNull();
    expect(imageAspect(undefined, undefined)).toBeNull();
  });

  it('measures relative drift between two ratios', () => {
    expect(aspectDrift(1, 1)).toBe(0);
    expect(aspectDrift(1.2, 1)).toBeCloseTo(0.2, 5);
    expect(aspectDrift(null, 1)).toBeNull();
  });
});
