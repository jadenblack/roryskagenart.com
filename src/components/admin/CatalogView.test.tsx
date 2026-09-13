import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogView } from './CatalogView';
import { ArtworkRecord, UserRole } from '../../types';

/**
 * Phase 1 FIXED contracts for the admin catalog table (docs/PRD.md §5-6).
 * Flipped from the Phase 0 baselines: the row menu is a portaled Radix menu,
 * every action fires exactly once, and destructive actions confirm first.
 */

const mkArtwork = (over: Partial<ArtworkRecord> = {}): ArtworkRecord => ({
  slug: 'giandonor',
  title: 'Giandonor',
  year: '2024',
  medium: 'Enamel',
  dimensions: '48" x 60"',
  price: '$5,200',
  status: 'Available',
  gallery_series: 'Neon Americana',
  edition: 'Original Painting',
  location: 'Austin Studio',
  imageUrl: '',
  featured_image: '',
  narrative: '',
  heroSlider: false,
  enabled: true,
  archived: false,
  trashed: false,
  ...over,
} as ArtworkRecord);

const PROPS = () => ({
  artworks: [
    mkArtwork(),
    mkArtwork({ slug: 'terrordon', title: 'Terrordon', status: 'Sold', price: 'Sold ($3,500)' }),
  ],
  role: 'admin' as UserRole,
  onSelectArtwork: vi.fn(),
  onToggleHero: vi.fn(),
  onToggleEnabled: vi.fn(),
  onToggleArchive: vi.fn(),
  onTrash: vi.fn(),
  onRestore: vi.fn(),
  onPermanentDelete: vi.fn(),
  onEdit: vi.fn(),
  onCreate: vi.fn(),
});

type Props = ReturnType<typeof PROPS>;

async function openRowMenu(props: Props, title: string) {
  const row = screen.getByText(title).closest('tr')!;
  const menuBtn = within(row).getByRole('button', { name: /actions for/i });
  await userEvent.click(menuBtn);
  return row;
}

describe('<CatalogView/> fixed contracts', () => {
  let props: Props;
  beforeEach(() => {
    props = PROPS();
  });

  it('renders both rows with status badges', () => {
    render(<CatalogView {...props} />);
    expect(screen.getByText('Giandonor')).toBeInTheDocument();
    expect(screen.getByText('Terrordon')).toBeInTheDocument();
    expect(screen.getAllByText('Available').length).toBeGreaterThanOrEqual(1);
  });

  it('row title button calls onSelectArtwork with the slug', async () => {
    render(<CatalogView {...props} />);
    await userEvent.click(screen.getByText('Terrordon'));
    expect(props.onSelectArtwork).toHaveBeenCalledWith('terrordon');
    expect(props.onSelectArtwork).toHaveBeenCalledTimes(1);
  });

  it('FIXED: row menu is portal-rendered (role="menu") — immune to table overflow clipping', async () => {
    render(<CatalogView {...props} />);
    await openRowMenu(props, 'Giandonor');

    const menu = screen.getByRole('menu');
    expect(menu.getAttribute('data-state')).toBe('open');
    // Radix scroll-lock engaged — modal-grade layering active
    expect(document.body.getAttribute('data-scroll-locked')).toBe('1');
    // The menu must NOT live inside the Table's overflow-auto wrapper (the
    // old inline-panel bug that clipped bottom-row menus)
    const overflowWrapper = document.querySelector('.overflow-auto');
    expect(overflowWrapper).toBeTruthy();
    expect(overflowWrapper!.contains(menu)).toBe(false);
    expect(within(menu).getByText('Edit details')).toBeInTheDocument();
  });

  it('FIXED: each menu choice fires its handler exactly once with the row slug', async () => {
    render(<CatalogView {...props} />);
    await openRowMenu(props, 'Giandonor');

    await userEvent.click(screen.getByText('View'));
    expect(props.onSelectArtwork).toHaveBeenCalledTimes(1);
    expect(props.onSelectArtwork).toHaveBeenCalledWith('giandonor');

    // Menu closed after selection; open fresh for the next action
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await openRowMenu(props, 'Giandonor');
    await userEvent.click(screen.getByText('Edit details'));
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledWith('giandonor');
  });

  it('FIXED: "Move to trash" opens a confirmation and only trashes on confirm', async () => {
    render(<CatalogView {...props} />);
    await openRowMenu(props, 'Giandonor');
    await userEvent.click(screen.getByText('Move to trash'));

    // Confirmation dialog appears; nothing deleted yet
    expect(await screen.findByText(/Move to trash\?/i)).toBeInTheDocument();
    expect(props.onTrash).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /^Move to trash$/i }));
    expect(props.onTrash).toHaveBeenCalledTimes(1);
    expect(props.onTrash).toHaveBeenCalledWith('giandonor');
  });

  it('trash confirmation can be cancelled without deleting', async () => {
    render(<CatalogView {...props} />);
    await openRowMenu(props, 'Giandonor');
    await userEvent.click(screen.getByText('Move to trash'));

    await userEvent.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(props.onTrash).not.toHaveBeenCalled();
    expect(screen.queryByText(/Move to trash\?/i)).not.toBeInTheDocument();
  });

  it('permanent delete confirms via its dialog and deletes on confirm', async () => {
    render(
      <CatalogView
        {...props}
        artworks={[mkArtwork({ trashed: true, status: 'Trashed' })]}
      />
    );
    await userEvent.click(screen.getByText('Trashed'));
    await openRowMenu(props, 'Giandonor');
    await userEvent.click(screen.getByText('Delete permanently'));

    expect(await screen.findByText(/Delete permanently\?/i)).toBeInTheDocument();
    expect(props.onPermanentDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /delete forever/i }));
    expect(props.onPermanentDelete).toHaveBeenCalledWith('giandonor');
  });

  it('archive action fires immediately (non-destructive, reversible)', async () => {
    render(<CatalogView {...props} />);
    await openRowMenu(props, 'Giandonor');
    await userEvent.click(screen.getByText('Archive'));
    expect(props.onToggleArchive).toHaveBeenCalledTimes(1);
    expect(props.onToggleArchive).toHaveBeenCalledWith('giandonor', true);
  });

  it('hero switches: two per row (hero + enabled); toggling the hero switch calls onToggleHero once', async () => {
    render(<CatalogView {...props} />);
    const row = screen.getByText('Giandonor').closest('tr')!;
    const switches = within(row).getAllByRole('switch');
    expect(switches.length).toBe(2);
    await userEvent.click(switches[0]);
    expect(props.onToggleHero).toHaveBeenCalledWith('giandonor', true);
    expect(props.onToggleHero).toHaveBeenCalledTimes(1);
  });

  it('search filter narrows rows', async () => {
    render(<CatalogView {...props} />);
    await userEvent.type(screen.getByPlaceholderText(/search title/i), 'Terrordon');
    expect(screen.queryByText('Giandonor')).not.toBeInTheDocument();
    expect(screen.getByText('Terrordon')).toBeInTheDocument();
  });

  it('FIXED: clicking anywhere on a data row triggers the view action once', async () => {
    render(<CatalogView {...props} />);
    // Click a plain cell (Series) — not the title button — to prove the whole row is the target
    const row = screen.getByText('Terrordon').closest('tr')!;
    await userEvent.click(within(row).getByText('Neon Americana'));
    expect(props.onSelectArtwork).toHaveBeenCalledTimes(1);
    expect(props.onSelectArtwork).toHaveBeenCalledWith('terrordon');
  });

  it('FIXED: row-interior controls do not double-fire the view action', async () => {
    render(<CatalogView {...props} />);
    const row = screen.getByText('Giandonor').closest('tr')!;

    // Switch clicks must toggle only — never navigate
    const switches = within(row).getAllByRole('switch');
    await userEvent.click(switches[1]);
    expect(props.onToggleEnabled).toHaveBeenCalledWith('giandonor', false);
    expect(props.onSelectArtwork).not.toHaveBeenCalled();

    // Title button still opens the view exactly once (guarded against row bubbling)
    await userEvent.click(screen.getByText('Giandonor'));
    expect(props.onSelectArtwork).toHaveBeenCalledTimes(1);
    expect(props.onSelectArtwork).toHaveBeenCalledWith('giandonor');
  });
});
