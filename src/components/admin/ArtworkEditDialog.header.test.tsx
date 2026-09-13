import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { ArtworkEditDialog } from './ArtworkEditDialog';
import { ArtworkRecord } from '../../types';

/**
 * Sticky-header contracts (actions-at-top UX):
 *   - DialogHeader is sticky within the scrolling DialogContent
 *   - The artwork editor renders its action row (Cancel/Save draft/Publish)
 *     inside the header, before the form body
 *   - The header's primary button submits the form via requestSubmit
 */

const mkArtwork = (over: Partial<ArtworkRecord> = {}): ArtworkRecord => ({
  slug: 'wip-piece', title: 'Work In Progress', year: '2026', medium: 'Acrylic',
  dimensions: '48" x 60"', price: '', status: 'Available', gallery_series: 'Neon Americana',
  edition: '', location: '', imageUrl: '', featured_image: '', narrative: '',
  heroSlider: false, enabled: false, draft: true, archived: false, trashed: false,
  ...over,
} as ArtworkRecord);

describe('sticky dialog header contracts', () => {
  it('DialogHeader is sticky-pinned inside the scrolling content', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>T</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    const header = document.querySelector('[data-slot="dialog-header"]') as HTMLElement;
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
    const content = document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    expect(content.className).toContain('overflow-y-auto');
  });

  it('artwork editor renders the action row inside the sticky header', () => {
    render(
      <ArtworkEditDialog
        open
        artwork={mkArtwork()}
        seriesOptions={['Neon Americana']}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue({ success: true })}
      />
    );
    const header = screen.getByText(/work-in-progress/i).closest('[data-slot="dialog-header"]') as HTMLElement;
    expect(within(header).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /^publish$/i })).toBeInTheDocument();
    // The form body sits outside the header
    expect(within(header).queryByLabelText(/title/i)).not.toBeInTheDocument();
  });
});
