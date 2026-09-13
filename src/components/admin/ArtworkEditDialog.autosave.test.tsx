import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArtworkEditDialog } from './ArtworkEditDialog';
import { ArtworkRecord } from '../../types';

/**
 * Auto-save contracts (draft UX follow-up to PRD Phase 3):
 *   - Editing a persisted draft auto-saves after the debounce window
 *   - Create mode NEVER auto-saves (explicit Save-as-draft first)
 *   - Published (non-draft) records NEVER auto-save
 *   - Rapid keystrokes batch into one save (debounce)
 *   - Closing the dialog flushes unsaved draft edits
 *   - Empty-title drafts are never persisted by autosave
 *   - Save failure surfaces in the status indicator
 *
 * Real timers + a 10ms injected debounce: fake timers hang inside userEvent
 * on Radix dialogs (verified by probe), and the debounce value is what the
 * contract actually cares about — not the wall-clock size.
 */
// 400ms: negative assertions ("not called yet" right after typing) stay
// deterministic, positive ones waitFor — total test time still ~2s.
const DEBOUNCE = 400;

const mkArtwork = (over: Partial<ArtworkRecord> = {}): ArtworkRecord => ({
  slug: 'wip-piece',
  title: 'Work In Progress',
  year: '2026',
  medium: 'Acrylic',
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
  enabled: false,
  draft: true,
  archived: false,
  trashed: false,
  ...over,
} as ArtworkRecord);

const PROPS = (artwork: ArtworkRecord | null) => ({
  open: true,
  artwork,
  seriesOptions: ['Neon Americana', 'Atomic Pop'],
  onClose: vi.fn(),
  onSave: vi.fn().mockResolvedValue({ success: true, slug: artwork?.slug ?? 'new-slug' }),
  onCreated: vi.fn(),
  autosaveDebounceMs: DEBOUNCE,
});

type Props = ReturnType<typeof PROPS>;

/** userEvent on real timers (no advanceTimers — that option requires fake timers). */
const user = () => userEvent.setup();

describe('<ArtworkEditDialog/> auto-save', () => {
  let props: Props;
  beforeEach(() => {
    props = PROPS(mkArtwork());
  });

  it('auto-saves a persisted draft after the debounce window', async () => {
    props = PROPS(mkArtwork());
    render(<ArtworkEditDialog {...props} />);

    await user().type(screen.getByLabelText(/title/i), '!');
    expect(props.onSave).not.toHaveBeenCalled();

    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'wip-piece', draft: true, title: 'Work In Progress!' })
    );
    // Draft saves keep the dialog open
    expect(props.onClose).not.toHaveBeenCalled();
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it('batches rapid keystrokes into a single autosave', async () => {
    props = PROPS(mkArtwork());
    render(<ArtworkEditDialog {...props} />);

    await user().type(screen.getByLabelText(/title/i), 'abc');
    // Advance partway — debounce restarts on each keystroke
    await new Promise((r) => setTimeout(r, DEBOUNCE / 2));
    await user().type(screen.getByLabelText(/title/i), 'd');
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Work In Progressabcd' })
    );
  });

  it('create mode never auto-saves (explicit Save-as-draft first)', async () => {
    props = PROPS(null);
    render(<ArtworkEditDialog {...props} />);

    await user().type(screen.getByLabelText(/title/i), 'Brand New Piece');
    await new Promise((r) => setTimeout(r, DEBOUNCE * 5));
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('published (non-draft) records never auto-save', async () => {
    props = PROPS(mkArtwork({ draft: false, enabled: true }));
    render(<ArtworkEditDialog {...props} />);

    await user().type(screen.getByLabelText(/title/i), 'x');
    await new Promise((r) => setTimeout(r, DEBOUNCE * 5));
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('closing the dialog flushes unsaved draft edits', async () => {
    props = PROPS(mkArtwork());
    render(<ArtworkEditDialog {...props} />);

    await user().type(screen.getByLabelText(/title/i), ' flushed');
    // Close before the debounce fires
    await user().click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(props.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'wip-piece', draft: true, title: 'Work In Progress flushed' })
      )
    );
  });

  it('autosave skips saves while the title is empty', async () => {
    props = PROPS(mkArtwork({ title: '' }));
    render(<ArtworkEditDialog {...props} />);

    await user().type(screen.getByLabelText(/price/i), '$1,000');
    await new Promise((r) => setTimeout(r, DEBOUNCE * 5));
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('surfaces save failure in the status indicator and keeps the dialog open', async () => {
    props = PROPS(mkArtwork());
    props.onSave.mockResolvedValue({ success: false, error: 'Network unreachable' });
    render(<ArtworkEditDialog {...props} />);

    await user().type(screen.getByLabelText(/title/i), '!');
    await waitFor(() => expect(screen.getByText(/save failed/i)).toBeInTheDocument(), { timeout: 2000 });
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
