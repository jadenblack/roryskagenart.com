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

/**
 * Header/body alignment (v2.16.0).
 *
 * `DialogHeader` bleeds out to the dialog's edges and then re-pads itself, so it has to read the
 * same padding the content uses. It used to hard-code `-m-6 px-6 pt-6` against the content's `p-6`;
 * any dialog that changed its own padding (the inquiry modal's `sm:p-8`) therefore left its title
 * sitting at a different inset from the fields below it. Both now read `--dialog-pad`.
 */
describe('dialog spacing contract', () => {
  const contentEl = () => document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
  const headerEl = () => document.querySelector('[data-slot="dialog-header"]') as HTMLElement;

  it('content publishes its padding as --dialog-pad and pads itself from it', () => {
    render(<Harness />);
    const cls = contentEl().className;
    expect(cls).toContain('[--dialog-pad:1.5rem]');
    expect(cls).toContain('p-[var(--dialog-pad)]');
    // The hard-coded `p-6` is gone: padding has exactly one source.
    expect(cls).not.toMatch(/(^|\s)p-6(\s|$)/);
  });

  it('header derives every inset from --dialog-pad, so it can never drift from the body', () => {
    render(<Harness />);
    const cls = headerEl().className;
    expect(cls).toContain('px-[var(--dialog-pad)]');
    expect(cls).toContain('pt-[var(--dialog-pad)]');
    expect(cls).toContain('mt-[calc(var(--dialog-pad)*-1)]');
    expect(cls).toContain('mx-[calc(var(--dialog-pad)*-1)]');
    // No hard-coded inset is left to contradict the variable.
    expect(cls).not.toMatch(/(^|\s)-m-6(\s|$)/);
    expect(cls).not.toMatch(/(^|\s)px-6(\s|$)/);
  });

  it('bottom rhythm totals one --dialog-pad instead of stacking pb-4 on top of the grid gap', () => {
    render(<Harness />);
    const cls = headerEl().className;
    // 0.75rem of padding + (gap 1rem − 0.25rem of negative margin) = 1.5rem, matching every other
    // gap in the dialog. Previously pb-4 + gap-4 put 2rem below the header against 1.5rem above it.
    expect(cls).toContain('pb-3');
    expect(cls).toContain('-mb-1');
    expect(cls).not.toMatch(/(^|\s)pb-4(\s|$)/);
  });

  it('a call site can override the padding and the header follows it', () => {
    render(
      <Dialog open>
        <DialogContent className="sm:[--dialog-pad:2rem]">
          <DialogHeader>
            <DialogTitle>Wide dialog</DialogTitle>
          </DialogHeader>
          <p>body</p>
        </DialogContent>
      </Dialog>
    );
    // The override is a variable, not a competing `p-*` utility — so the base padding is intact
    // and only the value it resolves to changes.
    const cls = contentEl().className;
    expect(cls).toContain('sm:[--dialog-pad:2rem]');
    expect(cls).toContain('p-[var(--dialog-pad)]');
  });

  it('still lets a call site drop the padding entirely (edge-to-edge layouts)', () => {
    render(
      <Dialog open>
        <DialogContent className="p-0">
          <DialogTitle>Flush dialog</DialogTitle>
          <p>body</p>
        </DialogContent>
      </Dialog>
    );
    const cls = contentEl().className;
    expect(cls).toContain('p-0');
    expect(cls).not.toContain('p-[var(--dialog-pad)]');
  });
});
