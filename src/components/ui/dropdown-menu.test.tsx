import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './dropdown-menu';
import { Button } from './button';

/**
 * Phase 1 FIXED contracts (docs/PRD.md §5). Flipped from the Phase 0
 * baselines that pinned the broken hand-rolled menu: content is portaled
 * (no more clipping inside overflow containers), items carry real
 * menu/menuitem roles, arrow keys navigate, and selection is reliable.
 */

function Harness({ onAction }: { onAction: (name: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Row actions">
          …
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Giandonor</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAction('view')}>View</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('edit')}>Edit details</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onAction('trash')}>
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('<DropdownMenu/> fixed contracts', () => {
  it('opens on trigger click and shows items', async () => {
    render(<Harness onAction={vi.fn()} />);
    expect(screen.queryByText('Edit details')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }));
    expect(screen.getByText('Edit details')).toBeInTheDocument();
  });

  it('FIXED: content is portal-rendered to document.body — it can never clip inside overflow-auto tables', async () => {
    render(<Harness onAction={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }));

    const content = screen.getByText('Edit details').closest('[data-slot="dropdown-menu-content"]');
    expect(content).toBeTruthy();
    // Rendered in a document.body portal (Radix FocusGuard siblings live in
    // body too), NOT inline inside the component tree next to the trigger.
    expect(content!.closest('[data-slot="dropdown-menu"]')).toBeNull();
    expect(content!.getAttribute('data-state')).toBe('open');
    // Body-level scroll lock engaged by Radix while the menu is open
    expect(document.body.getAttribute('data-scroll-locked')).toBe('1');
  });

  it('FIXED: proper menu semantics — role="menu" with role="menuitem" children', async () => {
    render(<Harness onAction={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    // Radix manages item focusability via data-disabled; enabled items are
    // keyboard-reachable (tabIndex is Radix-managed, so check the attribute
    // contract rather than a literal value in jsdom).
    for (const item of items) {
      expect(item.getAttribute('data-disabled')).toBeNull();
    }
  });

  it('FIXED: trigger carries aria-haspopup/aria-expanded state', async () => {
    render(<Harness onAction={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /row actions/i });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('FIXED: ArrowDown opens the menu and moves focus between items', async () => {
    render(<Harness onAction={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /row actions/i });

    // Radix opens menus with ArrowDown and focuses the first item
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const menu = await screen.findByRole('menu');
    expect(document.activeElement).not.toBe(trigger);
    expect(menu.contains(document.activeElement)).toBe(true);
    expect(screen.getAllByRole('menuitem')).toContain(document.activeElement);
  });

  it('item selection fires onSelect exactly once and closes the menu', async () => {
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }));

    await userEvent.click(screen.getByText('Edit details'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('edit');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Escape closes the menu', async () => {
    render(<Harness onAction={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /row actions/i });
    await userEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Trigger reflects closed state
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('outside pointerdown closes the menu', async () => {
    render(
      <>
        <div data-testid="outside">outside</div>
        <Harness onAction={vi.fn()} />
      </>
    );
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Radix dismisses on outside pointerdown; the menu portal sets
    // pointer-events:none on body (real browser passes events through to the
    // content, jsdom does not), so fire the raw event instead of a click.
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('destructive item is marked data-destructive and styled', async () => {
    render(<Harness onAction={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /row actions/i }));
    const trash = screen.getByText('Move to trash').closest('[data-slot="dropdown-menu-item"]') as HTMLElement;
    expect(trash).toBeTruthy();
    expect(trash.getAttribute('data-destructive')).not.toBeNull();
    expect(trash.className).toContain('text-destructive');
  });
});
