import React, { useState } from 'react';
import { ArtworkRecord } from '../types';
import { X, Send, CheckCircle2, ShieldCheck } from 'lucide-react';

interface InquiryModalProps {
  artwork?: ArtworkRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InquiryModal: React.FC<InquiryModalProps> = ({ artwork, isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState(
    artwork
      ? `Acquisition inquiry for entity "${artwork.title}" (${artwork.year}, ${artwork.price}). Requesting provenance dossier and crating/delivery specifications.`
      : 'Studio and commission inquiry for custom painting / public installation.'
  );
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="relative w-full max-w-lg bg-[#0D0D10] border border-zinc-800 p-6 sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 p-1.5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">
              Transmission Complete
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Inquiry for <strong className="text-white">{artwork ? artwork.title : 'Rory Skagen Studio'}</strong> logged to archive dispatch. Studio director will respond within 24 standard business hours.
            </p>
            <div className="pt-4">
              <button
                onClick={() => {
                  setSubmitted(false);
                  onClose();
                }}
                className="px-6 py-2.5 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-200 transition-colors"
              >
                Close Dispatch
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-500 mb-1">
                <span className="w-1.5 h-1.5 bg-white"></span>
                <span>RORY SKAGEN STUDIO DISPATCH</span>
              </div>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white font-sans">
                {artwork ? `Acquire: ${artwork.title}` : 'Studio & Commission Inquiry'}
              </h2>
              {artwork && (
                <p className="text-[10px] text-zinc-500 mt-1">
                  Valuation: <span className="text-white font-bold">{artwork.price}</span> • {artwork.medium} ({artwork.dimensions})
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-[10px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Collector / Institution"
                    className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="collector@domain.com"
                    className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                    Telephone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (512) 000-0000"
                    className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                    Location / City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Austin, TX / New York, NY"
                    className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-500 uppercase tracking-wider mb-1 text-[9px]">
                  Inquiry Message / Delivery Specifications
                </label>
                <textarea
                  rows={3}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none leading-relaxed"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Certificate of Authenticity</span>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Submit Inquiry
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
