import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogView } from './CatalogView';
import { ArtworkRecord, UserRole } from '../../types';

/**
 * Phase 3 draft contracts (docs/PRD.md §4, §5):
 *   - Drafts are invisible to the public catalog (never in the default/Active view)
 *   - Drafts get a badge and live in their own Drafts tab with a count
 *   - Publish/Unpublish fire exactly once via the row menu
 *   - Row-click View still works on draft rows without double-firing
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
    mkArtwork({ slug: 'wip-piece', title: 'Work In Progress', draft: true, enabled: false }),
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
  onSetDraft: vi.fn(),
});

type Props = ReturnType<typeof PROPS>;

describe('<CatalogView/> draft contracts', () => {
  let props: Props;
  beforeEach(() => {
    props = PROPS();
  });

  it('Active view excludes drafts entirely (public-catalog parity)', () => {
    render(<CatalogView {...props} />);
    expect(screen.getByText('Giandonor')).toBeInTheDocument();
    expect(screen.queryByText('Work In Progress')).not.toBeInTheDocument();
  });

  it('Drafts tab shows the count badge and only draft rows', async () => {
    render(<CatalogView {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /drafts/i }));

    expect(screen.getByText('Drafts (1)')).toBeInTheDocument();
    expect(screen.getByText('Work In Progress')).toBeInTheDocument();
    expect(screen.queryByText('Giandonor')).not.toBeInTheDocument();

    // Draft badge on the row's status cell
    const row = screen.getByText('Work In Progress').closest('tr')!;
    expect(within(row).getByText('Draft')).toBeInTheDocument();
  });

  it('Drafts menu: Publish fires onSetDraft(slug, false) exactly once', async () => {
    render(<CatalogView {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /drafts/i }));

    const row = screen.getByText('Work In Progress').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /actions for/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /publish/i }));

    expect(props.onSetDraft).toHaveBeenCalledTimes(1);
    expect(props.onSetDraft).toHaveBeenCalledWith('wip-piece', false);
  });

  it('Active menu: Unpublish to draft fires onSetDraft(slug, true) exactly once', async () => {
    render(<CatalogView {...props} />);

    const row = screen.getByText('Giandonor').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /actions for/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /unpublish to draft/i }));

    expect(props.onSetDraft).toHaveBeenCalledTimes(1);
    expect(props.onSetDraft).toHaveBeenCalledWith('giandonor', true);
  });

  it('Draft rows keep row-click View working', async () => {
    render(<CatalogView {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /drafts/i }));

    const row = screen.getByText('Work In Progress').closest('tr')!;
    await userEvent.click(within(row).getByText('Neon Americana'));
    expect(props.onSelectArtwork).toHaveBeenCalledTimes(1);
    expect(props.onSelectArtwork).toHaveBeenCalledWith('wip-piece');
  });

  it('Viewer role sees draft rows but has no actions menus', async () => {
    render(<CatalogView {...props} role={'viewer' as UserRole} />);
    await userEvent.click(screen.getByRole('button', { name: /drafts/i }));

    expect(screen.getByText('Work In Progress')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actions for/i })).not.toBeInTheDocument();
  });

  it('Unpublish item is absent when onSetDraft is not provided', async () => {
    const { onSetDraft, ...withoutDraft } = props;
    render(<CatalogView {...withoutDraft} />);

    const row = screen.getByText('Giandonor').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /actions for/i }));
    expect(screen.queryByRole('menuitem', { name: /unpublish to draft/i })).not.toBeInTheDocument();
  });
});
