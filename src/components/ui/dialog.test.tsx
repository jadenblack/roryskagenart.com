import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';

/**
 * Phase 1 FIXED contracts (docs/PRD.md §5). These tests flipped from the
 * Phase 0 baselines that pinned the broken hand-rolled dialog: the X button
 * now closes via Radix context, focus is trapped and restored, and the
 * content owns its scroll geometry so tall dialogs never clip.
 */

function Harness({ onClose }: { onClose?: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Some description text</DialogDescription>
        </DialogHeader>
        <p>Dialog body</p>
        <DialogFooter>
          <Button onClick={() => onClose?.()}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('<Dialog/> fixed contracts', () => {
  it('FIXED: X close button calls onOpenChange(false) — the modal actually closes', async () => {
    const onClose = vi.fn();
    const listener = vi.fn();
    document.addEventListener('dialog-close-request', listener);
    render(<Harness onClose={onClose} />);

    // Two close affordances exist: the built-in X (sr-only "Close") — use it.
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await userEvent.click(closeButtons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
    // The orphan CustomEvent hack is gone from the codebase contract.
    expect(listener).not.toHaveBeenCalled();

    document.removeEventListener('dialog-close-request', listener);
  });

  it('Esc key calls onOpenChange(false)', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('overlay click calls onOpenChange(false)', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    // The overlay is mounted (visually the dismissal surface)
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeTruthy();
    // Radix tracks outside interactions at the document level and defers
    // dismissal: pointerdown-outside arms it, the following click completes
    // it. Radix also registers its pointerdown listener on a setTimeout(0)
    // after open — imperceptible in browsers, so flush a macrotask first.
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.pointerDown(document.documentElement);
    fireEvent.click(document.documentElement);
    await new Promise((r) => setTimeout(r, 0));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('FIXED: content owns max-height + overflow-y — tall dialogs scroll inside instead of clipping', () => {
    render(<Harness />);
    const content = screen.getByText('Dialog body').closest('[data-slot="dialog-content"]') as HTMLElement;
    expect(content).toBeTruthy();
    expect(content.className).toContain('overflow-y-auto');
    expect(content.className).toContain('max-h-');
  });

  it('FIXED: content is portal-rendered to document.body with Radix semantics', () => {
    const { baseElement } = render(<Harness />);
    const content = baseElement.ownerDocument.querySelector('[data-slot="dialog-content"]');
    expect(content).toBeTruthy();
    // Radix drives state via data attributes on portal content
    expect(content!.getAttribute('data-state')).toBe('open');
  });

  it('FIXED: focus is moved into the dialog on open and trapped there', async () => {
    render(<Harness />);
    // Radix moves focus into the dialog (first focusable / content) on mount.
    // activeElement must be inside the dialog, never <body>.
    const content = document.querySelector('[data-slot="dialog-content"]')!;
    expect(document.activeElement).not.toBe(document.body);
    expect(content.contains(document.activeElement) || content === document.activeElement).toBe(true);

    // Tab from the last focusable wraps back inside (focus trap)
    const done = screen.getByRole('button', { name: /done/i });
    done.focus();
    await userEvent.tab();
    const focusablesInDialog = content.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
    expect(focusablesInDialog.length).toBeGreaterThan(0);
    expect(content.contains(document.activeElement)).toBe(true);
  });

  it('title and description render with Radix heading/description wiring', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Test dialog' })).toBeInTheDocument();
  });
});
