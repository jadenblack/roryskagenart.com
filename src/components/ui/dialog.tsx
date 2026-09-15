import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui dialog — official registry source (Tailwind v4 edition) on top of
 * @radix-ui/react-dialog. Phase 1 of docs/PRD.md.
 *
 * Replaces the hand-rolled dialog whose X button dispatched an event nobody
 * listened for and whose flex-centered viewport clipped tall content. Radix
 * provides: working Close (context-wired to onOpenChange), focus trap +
 * restore, background scroll lock, Esc/overlay dismiss, and portal rendering.
 *
 * Additive default vs upstream: DialogContent carries
 * `max-h-[calc(100dvh-2rem)] overflow-y-auto` so tall forms scroll *inside*
 * the dialog on short viewports without per-call-site patches.
 */

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
        className
      )}
      {...props}
    />
  );
}

/**
 * The dialog's interior padding, as a custom property.
 *
 * `DialogHeader` bleeds to the dialog's edges with a negative inset and then re-pads itself — so it
 * has to know how much padding the content has, or the title stops lining up with the fields beneath
 * it. Hard-coding both (`p-6` here, `-m-6 px-6` there) meant any dialog that changed its own padding
 * silently misaligned its header; that is the bug this variable exists to make impossible.
 *
 * Override it at the call site with a *variant* (`sm:[--dialog-pad:2rem]`) rather than with `p-*` —
 * a bare `p-8` would replace the padding without moving the header with it.
 */
const DIALOG_PAD = '[--dialog-pad:1.5rem] p-[var(--dialog-pad)]';

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border shadow-lg duration-200 sm:max-w-lg',
          DIALOG_PAD,
          // Scroll hardening (PRD §5): the dialog owns its scroll geometry so
          // centering can never clip — max-height keeps the content within
          // the viewport and overflow-y handles long forms.
          'max-h-[calc(100dvh-2rem)] overflow-y-auto',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      // Sticky header: pinned to the top of the scrolling dialog so the title
      // and (absolutely-positioned) X stay visible while long forms scroll.
      //
      // Every inset is derived from `--dialog-pad`, so the header's content box always lines up with
      // the body's no matter what padding the call site asks for. The negative `mt`/`mx` are what
      // bleed the header (and its bottom rule) out to the dialog's edges.
      //
      // Bottom rhythm: `pb-3` puts the rule 0.75rem under the title, and `-mb-1` claws a quarter-rem
      // back out of the container's `gap-4`, leaving 0.75rem between the rule and the body. The
      // result is that the space above the title, beside it, and between it and the body are all one
      // `--dialog-pad` — previously the gap below stacked `pb-4` + `gap-4` (2rem) against 1.5rem
      // everywhere else, which read as the header sitting high in its own band.
      className={cn(
        'sticky top-0 z-10 -mb-1 mt-[calc(var(--dialog-pad)*-1)] mx-[calc(var(--dialog-pad)*-1)] bg-background px-[var(--dialog-pad)] pt-[var(--dialog-pad)] pb-3 flex flex-col gap-2 text-center sm:text-left rounded-t-lg border-b',
        className
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      // Sticky-footer variant: add `sticky bottom-0` at the call site for
      // action rows that must stay reachable while a long form scrolls.
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
