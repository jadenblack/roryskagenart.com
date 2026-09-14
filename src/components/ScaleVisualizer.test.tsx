import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScaleVisualizer } from './ScaleVisualizer';
import type { ArtworkRecord } from '../types';

function makeArtwork(overrides: Partial<ArtworkRecord> = {}): ArtworkRecord {
  return {
    slug: 'the-balloon-cats-ii',
    title: 'The Balloon Cats II',
    year: 2015,
    medium: 'Acrylic',
    dimensions: '3.5ft x 5ft',
    status: 'Sold',
    price: 'Sold',
    featured_image: 'the-balloon-cats-ii.jpg',
    imageUrl: 'https://example.test/hero.jpg',
    gallery_series: 'Neon Americana',
    narrative: '',
    filePath: 'posts/the-balloon-cats-ii.md',
    ...overrides,
  };
}

const viewBox = (container: HTMLElement) =>
  container.querySelector('svg')?.getAttribute('viewBox') ?? '';

describe('ScaleVisualizer', () => {
  it('says so instead of inventing a box when dimensions are missing', () => {
    const { container } = render(<ScaleVisualizer artwork={makeArtwork({ dimensions: '- (-)' })} />);

    expect(screen.getByText(/no dimensions recorded/i)).toBeInTheDocument();
    // No scale drawing — only the lucide icon in the empty state is an <svg>.
    expect(container.querySelector('svg[role="img"]')).toBeNull();
  });

  it('draws to a 10-foot reference wall for a normal painting', () => {
    // 3.5ft x 5ft = 42 x 60 in, which fits comfortably under a 10 ft ceiling.
    const { container } = render(<ScaleVisualizer artwork={makeArtwork()} />);
    const [x, y, w, h] = viewBox(container).split(' ').map(Number);

    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(h).toBe(120);
    // Bay = artwork width + the left reference (human) + the right reference (bench).
    expect(w).toBeGreaterThan(42);
  });

  it('grows the reference room so a mural is not drawn through the ceiling', () => {
    const { container } = render(
      <ScaleVisualizer artwork={makeArtwork({ dimensions: '20ft x 12ft' })} />
    );
    const [, , , h] = viewBox(container).split(' ').map(Number);

    // 12 ft tall (144 in) cannot be shown inside a 120 in room.
    expect(h).toBeGreaterThan(144);
  });

  it('scales the artwork rectangle from the recorded inches, not a category', () => {
    const frame = (c: HTMLElement) => c.querySelector('[data-artwork-frame]');

    const small = frame(render(<ScaleVisualizer artwork={makeArtwork({ dimensions: '12" x 12"' })} />).container);
    const large = frame(render(<ScaleVisualizer artwork={makeArtwork({ dimensions: '96" x 96"' })} />).container);

    // The frame is the recorded size in inches, in a 1 inch = 1 unit drawing.
    expect(small?.getAttribute('data-width-in')).toBe('12');
    expect(small?.getAttribute('width')).toBe('12');
    expect(large?.getAttribute('data-width-in')).toBe('96');
    expect(large?.getAttribute('width')).toBe('96');

    // Feet notation resolves to the same inches.
    const feet = frame(render(<ScaleVisualizer artwork={makeArtwork({ dimensions: '3.5ft x 5ft' })} />).container);
    expect(feet?.getAttribute('data-width-in')).toBe('42');
    expect(feet?.getAttribute('data-height-in')).toBe('60');
  });

  it('labels the drawing for screen readers with the true measurements', () => {
    render(<ScaleVisualizer artwork={makeArtwork()} />);

    const svg = screen.getByRole('img');
    const label = svg.getAttribute('aria-label') || '';
    expect(label).toContain('The Balloon Cats II');
    expect(label).toContain('42 × 60 in');
    expect(label).toContain('5′ 10″'); // human reference
    expect(label).toContain('6′'); // bench reference
  });

  it('states the true-scale assumption in plain language', () => {
    render(<ScaleVisualizer artwork={makeArtwork()} />);
    expect(screen.getByText(/drawn to true scale/i)).toBeInTheDocument();
    // The height dimension label and the explanatory sentence both state it.
    expect(screen.getAllByText(/3′ 6″ × 5′/).length).toBeGreaterThan(0);
  });

  it('flags a photograph whose proportions disagree with the dimensions, for staff only', () => {
    const artwork = makeArtwork({
      dimensions: '42" x 60"',
      renditions: {
        hero: { url: 'https://example.test/hero.jpg', width: 1200, height: 400, bytes: 1 },
        thumb: null,
        full: null,
        lqip: null,
        source: 'supabase',
      },
    });

    const staff = render(<ScaleVisualizer artwork={artwork} showDataWarning />);
    expect(screen.getByText(/proportions differ from the recorded dimensions/i)).toBeInTheDocument();
    staff.unmount();

    const visitor = render(<ScaleVisualizer artwork={artwork} />);
    expect(screen.queryByText(/proportions differ from the recorded dimensions/i)).toBeNull();
  });

  it('stays quiet when the photograph matches the dimensions', () => {
    const artwork = makeArtwork({
      dimensions: '42" x 60"',
      renditions: {
        hero: { url: 'https://example.test/hero.jpg', width: 840, height: 1200, bytes: 1 },
        thumb: null,
        full: null,
        lqip: null,
        source: 'supabase',
      },
    });

    render(<ScaleVisualizer artwork={artwork} showDataWarning />);
    expect(screen.queryByText(/proportions differ from the recorded dimensions/i)).toBeNull();
  });
});
