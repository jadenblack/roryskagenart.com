import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArtworkFocusView } from './ArtworkFocusView';
import type { ArtworkRecord } from '../types';

/**
 * The stored record is a whole markdown document — it repeats the title, embeds
 * the hero image and links back to the catalog index. Rendering it verbatim put
 * a second copy of the artwork on the page and printed the raw drive filename.
 */
const RECORD = `[[index|← Return to Master Catalog Index]]

# The Balloon Cats II

![[the-balloon-cats-ii.jpg]]

> **Neon Americana** — Produced 2015-01-29
> **Medium & Dimensions:** Acrylic (3.5ft x 5ft) • 42 × 60 in (107 × 152 cm)
> **Status:** Sold • **Surface:** Acrylic on Baltic birch wooden panel

## Artwork Description

Original masterwork by Rory Skagen created on 2015-01-29, exploring anthropomorphic critters.`;

function makeArtwork(overrides: Partial<ArtworkRecord> = {}): ArtworkRecord {
  return {
    slug: 'the-balloon-cats-ii',
    title: 'The Balloon Cats II',
    year: 2015,
    medium: 'Acrylic',
    dimensions: '3.5ft x 5ft',
    dimensions_cm: '107 x 152 cm',
    status: 'Sold',
    price: 'Sold ($3,500)',
    featured_image: 'the-balloon-cats-ii.jpg',
    imageUrl: 'https://example.test/hero.jpg',
    gallery_series: 'Neon Americana',
    location: 'Private Collection',
    edition: 'Original Painting',
    narrative: RECORD,
    renderedHtml: '',
    filePath: 'posts/the-balloon-cats-ii.md',
    enabled: true,
    ...overrides,
  };
}

function renderView(props: Partial<React.ComponentProps<typeof ArtworkFocusView>> = {}) {
  const artwork = props.artwork ?? makeArtwork();
  return render(
    <ArtworkFocusView
      artwork={artwork}
      allArtworks={[artwork]}
      onBack={vi.fn()}
      onSelectArtwork={vi.fn()}
      onNavigatePage={vi.fn()}
      {...props}
    />
  );
}

describe('ArtworkFocusView — role gating', () => {
  it('shows no studio controls to a visitor without edit rights', () => {
    renderView();

    expect(screen.queryByText(/studio controls/i)).toBeNull();
    expect(screen.queryByText(/edit in studio/i)).toBeNull();
    expect(screen.queryByText(/hero slider/i)).toBeNull();
    expect(screen.queryByText(/to storage/i)).toBeNull();
    expect(screen.queryByText(/^trash$/i)).toBeNull();
  });

  it('shows the studio controls to an editor or administrator', () => {
    renderView({
      canManage: true,
      onEditInStudio: vi.fn(),
      onToggleEnable: vi.fn(),
      onToggleArchive: vi.fn(),
      onToggleHeroSlider: vi.fn(),
      onTrashArtwork: vi.fn(),
    });

    expect(screen.getByText(/studio controls/i)).toBeInTheDocument();
    expect(screen.getByText(/edit in studio/i)).toBeInTheDocument();
    expect(screen.getByText(/hero slider/i)).toBeInTheDocument();
  });

  it('passes the artwork slug to the studio deep link', () => {
    const onEditInStudio = vi.fn();
    renderView({ canManage: true, onEditInStudio, onToggleEnable: vi.fn() });

    screen.getByText(/edit in studio/i).click();
    expect(onEditInStudio).toHaveBeenCalledWith('the-balloon-cats-ii');
  });
});

describe('ArtworkFocusView — entry description', () => {
  it('promotes the description into the entry info near the top', () => {
    renderView();

    expect(screen.getByText(/artwork description/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Original masterwork by Rory Skagen created on 2015-01-29/)
    ).toBeInTheDocument();
  });

  it('does not render a second copy of the title or the image', () => {
    const { container } = renderView();

    // One heading for the page, one for the description label — not a third
    // from the markdown H1 that the record also carries.
    expect(screen.getAllByRole('heading', { name: /the balloon cats ii/i })).toHaveLength(1);
    // The narrative image embed must not be rendered anywhere.
    expect(container.querySelectorAll('img[src*="the-balloon-cats-ii.jpg"]').length).toBe(0);
  });

  it('never prints the raw drive filename', () => {
    const { container } = renderView();
    expect(container.textContent).not.toMatch(/\.md\b/);
  });

  it('offers the curator a nudge when the record has no description', () => {
    renderView({
      artwork: makeArtwork({
        narrative: '# The Balloon Cats II\n\nOriginal painting from the Rory Skagen Studio catalog.',
      }),
      canManage: true,
      onEditInStudio: vi.fn(),
      onToggleEnable: vi.fn(),
    });

    expect(screen.getByText(/no artwork description yet/i)).toBeInTheDocument();
    expect(screen.getByText(/write description/i)).toBeInTheDocument();
  });

  it('hides the placeholder nudge from visitors', () => {
    renderView({
      artwork: makeArtwork({
        narrative: '# The Balloon Cats II\n\nOriginal painting from the Rory Skagen Studio catalog.',
      }),
    });

    expect(screen.queryByText(/no artwork description yet/i)).toBeNull();
  });

  it('keeps the original document available as a collapsed catalog record', () => {
    const { container } = renderView();
    expect(screen.getByText(/catalog record/i)).toBeInTheDocument();
    // Collapsed by default: the source is not dumped on the page.
    expect(container.querySelector('pre')).toBeNull();
  });
});
