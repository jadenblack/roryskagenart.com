import React, { useEffect, useState } from 'react';
import { ArtworkRecord } from '../types';
import { Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

interface InquiryModalProps {
  artwork?: ArtworkRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Inquiry modal on the shared shadcn/Radix Dialog (PRD §5): portal, focus
 * trap, scroll lock, working X, Esc + overlay dismiss. Also fixes the stale
 * state bug: `submitted` used to persist after close, so reopening the modal
 * showed the "Message Sent" screen instead of the form.
 */
export const InquiryModal: React.FC<InquiryModalProps> = ({ artwork, isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState(() =>
    artwork
      ? `Inquiry for "${artwork.title}" (${artwork.year}, ${artwork.price}). Requesting purchase and delivery details.`
      : 'Studio and commission inquiry for custom fine art painting or mural installation.'
  );
  const [submitted, setSubmitted] = useState(false);

  // Reset transient state when the modal opens; re-seed the message when the
  // target artwork changes.
  useEffect(() => {
    if (isOpen) {
      setSubmitted(false);
      setMessage(
        artwork
          ? `Inquiry for "${artwork.title}" (${artwork.year}, ${artwork.price}). Requesting purchase and delivery details.`
          : 'Studio and commission inquiry for custom fine art painting or mural installation.'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, artwork?.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          artwork_slug: artwork?.slug || null,
          artwork_title: artwork?.title || null,
          inquiry_type: artwork ? 'Artwork Acquisition' : 'Studio Inquiry',
          message,
        }),
      });
    } catch (err) {
      console.warn('Inquiry dispatch notice:', err);
    }
    setSubmitted(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        // `sm:[--dialog-pad:2rem]` rather than `sm:p-8`: the dialog derives its padding from the
        // variable, so the header (and anything else that insets to the content edge) moves with it.
        className="max-w-lg bg-card border-line sm:[--dialog-pad:2rem] rounded-xs"
      >
        <DialogTitle className="sr-only">
          {artwork ? `Inquire: ${artwork.title}` : 'Studio and Commission Inquiry'}
        </DialogTitle>

        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto rounded-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-foreground uppercase tracking-wider font-sans">
              Message Sent
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed font-sans">
              Inquiry for <strong className="text-foreground font-bold">{artwork ? artwork.title : 'Rory Skagen Studio'}</strong> received. The studio will respond within 24 hours.
            </p>
            <div className="pt-4">
              <button
                onClick={() => {
                  setSubmitted(false);
                  onClose();
                }}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] text-[10px] hover:opacity-90 transition-opacity cursor-pointer rounded-xs shadow-xs"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          <div className="font-mono">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-muted-foreground mb-1 font-bold">
                <span className="w-1.5 h-1.5 bg-line-strong inline-block"></span>
                <span>RORY SKAGEN STUDIO</span>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-foreground font-sans">
                {artwork ? `Inquire: ${artwork.title}` : 'Studio and Commission Inquiry'}
              </h2>
              {artwork && (
                <p className="text-[10px] text-muted-foreground mt-1 font-sans">
                  Valuation: <span className="text-foreground font-bold">{artwork.price}</span> • {artwork.medium} ({artwork.dimensions})
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-[10px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Collector / Institution"
                    className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="collector@domain.com"
                    className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong rounded-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
                    Telephone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (512) 000-0000"
                    className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
                    Location / City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Austin, TX / New York, NY"
                    className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong rounded-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
                  Inquiry Message / Delivery Specifications
                </label>
                <textarea
                  rows={3}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-surface-deep border border-line px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:border-line-strong resize-none leading-relaxed rounded-xs font-mono"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Certificate of Authenticity</span>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] text-[10px] hover:opacity-90 transition-opacity cursor-pointer rounded-xs shadow-xs"
                >
                  Submit Inquiry
                </button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
